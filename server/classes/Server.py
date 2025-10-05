from dataclasses import dataclass
import time
from .SIOData import AddChatMessage, ClientDataMessage, LoadProfileMessage, StreamData, TextResponse
from .Profile import History, Profile
from typing import Any, AsyncGenerator, List, Optional, Type, TypeVar
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utils import logger
import socketio

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .Profile import Profile

@dataclass
class WebSocketClient():
    sid: str
    data: ClientDataMessage


class Server:
    def __init__(self):
        self.instance = FastAPI(root_path="/pa-server")
        self.activeProfile: Optional[Profile] = None
        self.profiles: List[Profile] = []
        self.client: WebSocketClient | None = None
        self.processing = False
        self.sio = socketio.AsyncServer(cors_allowed_origins="*",async_mode='asgi')


    def getApp(self):
        api = FastAPI()
        api.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        @api.get("/")
        def rootPathGet():
            return {"data": "Hello World"}
        @api.post("/")
        def rootPathPost(_: Any):
            return {"data": "post test"}
        
        @api.get("/profiles")
        def profiles():
            logger.info(f"Return profile list - {[p.name for p in self.profiles]}")
            return JSONResponse([p.name for p in self.profiles])

        self.instance.mount("/api", api)
        self.instance.mount("/", self.initWS())
        return self.instance

    async def addProfile(self, p: Profile):
        await p.setup(self)
        self.profiles.append(p)
    def finishTask(self):
        self.processing = False
        logger.info("Task Finished")
    async def startTask(self, sid: str | None):
        if not sid: sid = self.client.sid  # type: ignore
        if self.processing:
            try:
                await self.err(sid=sid, err="Error: Processing other task")
            except:
                pass
            return False
        self.processing = True
        logger.info("Task Start")
        return True
    async def emit(self, ev: str, sid: str | None = None, data: Any = None):
        if not sid: sid = self.client.sid  # type: ignore
        await self.sio.emit(event=ev, to=sid, data=data)
    async def err(self, sid: str, err: Any):
        if not sid: sid = self.client.sid  # type: ignore
        await self.emit(ev="err", sid=sid, data=f"Error: {err}")
    async def success(self, sid: str, data: Any = None):
        if not sid: sid = self.client.sid  # type: ignore
        await self.emit(ev="success", sid=sid, data=data)
    async def streamDelta(self, stream: AsyncGenerator[StreamData, Any], sid: str | None = None):
        if not sid: sid = self.client.sid  # type: ignore
        await self.emit(ev="streamStart", sid=sid)
        async for data in stream:
            if (data.audio): logger.info("Send stream delta")
            await self.emit(ev="streamDelta", sid=sid, data=data.model_dump())
        time.sleep(1)
        await self.emit(ev="streamEnd", sid=sid)
            
    def initWS(self):
        replaceClient = False
        T = TypeVar("T", bound=BaseModel)
        async def expectData(sid: str, data: Any, model: Type[T]) -> T | None:
            try:
                return model.model_validate(data)
            except:
                await self.err(err="Unknown data", sid=sid)
                return
            
        @self.sio.event
        async def init(sid, data):
            nonlocal replaceClient
            data = await expectData(sid, data, ClientDataMessage)
            if not data:
                self.finishTask()
                return
            if self.client:
                if not data.confirm:
                    await self.emit(ev="replaceClientConfirm", sid=sid)
                    self.finishTask()
                    return
                if not await self.startTask(sid): return
                replaceClient = True
                old_client = self.client
                logger.info(f'Replacing client sid="{old_client.sid}"')
                await self.emit(ev="connectionReplaced", sid=old_client.sid)
                await self.sio.disconnect(sid=old_client.sid)
                if not old_client.data.platform == data.platform and self.activeProfile and self.activeProfile.setting.platformAware:
                    logger.info("Inform platform change")
                    self.activeProfile.addHistory(content=History(role="developer", name="System", content=f'The user has changed the platform to {data.platform}'))
                    await self.activeProfile.saveHistory()
            self.client = WebSocketClient(sid=sid, data=data)
            logger.info(f'Client sid="{sid}" platform="{data.platform}" replace={replaceClient} established')
            replaceClient = False
            await self.success(sid=sid, data={"continueChat": self.activeProfile.name} if self.activeProfile else None)
            self.finishTask()

        @self.sio.event
        async def loadProfile(sid, data):
            if not self.client or not self.client.sid == sid: return
            if not await self.startTask(sid=sid): return
            data = await expectData(sid=sid, data=data, model=LoadProfileMessage)
            if not data:
                self.finishTask()
                return
            targetProfile = next((profile for profile in self.profiles if profile.name == data.profile), None)
            if not targetProfile:
                await self.err(err="Profile not found", sid=sid)
                self.finishTask()
                return
            continueChat = False
            if self.activeProfile:
                if not self.activeProfile.name == targetProfile.name:
                    await self.activeProfile.disconnect()
                else: continueChat = True
            self.activeProfile = targetProfile
            logger.info(f"Activating [{targetProfile.name}] continueChat={continueChat}")
            await self.activeProfile.connect(continueChat)
            await self.success(sid=sid)
            self.finishTask()

        @self.sio.event
        async def addChat(sid, data):
            if not self.client or not self.client.sid == sid: return
            if not await self.startTask(sid=sid): return
            data = await expectData(sid=sid, data=data, model=AddChatMessage)
            if not data:
                self.finishTask()
                return
            if not self.activeProfile:
                await self.err(err="No active profile", sid=sid)
                self.finishTask()
                return
            logger.info(f'[{self.activeProfile.name}] addChat requested')
            try:
                await self.activeProfile.addChat(msg=data.msg)
                await self.success(sid=sid)
            except Exception as e:
                await self.err(err=e, sid=sid)
            self.finishTask()

        @self.sio.event
        async def unload(sid):
            if not self.client or not self.client.sid == sid: return
            if not await self.startTask(sid=sid): return
            if not self.activeProfile:
                await self.err(err="No active profile", sid=sid)
                self.finishTask()
                return
            logger.info(f'Unload Profile "{self.activeProfile.name}" (Exited Chat)')
            await self.activeProfile.disconnect()
            self.activeProfile = None
            await self.success(sid=sid)
            self.finishTask()

        @self.sio.event
        async def connect(sid, environ):
            logger.info(f'Client sid="{sid}" connected')
            await self.sio.send(data=TextResponse(msg="OK").model_dump(), to=sid)
        
        @self.sio.event
        async def disconnect(sid, reason):
            if self.client and self.client.sid == sid:
                if sid == self.client.sid:
                    self.client = None
                    if not replaceClient and self.activeProfile:
                        logger.info(f'Unload Profile "{self.activeProfile.name}" (No Client)')
                        await self.activeProfile.disconnect()
                        self.activeProfile = None
                    logger.info(f'Client sid="{sid}" disconnected, reason="{reason}" replace={replaceClient}')
                else:
                    logger.info(f'Temp Client sid="{sid}" disconnected, reason="{reason}"')
        
        @self.sio.event
        async def listProfiles(sid):
            if not self.client or not self.client.sid == sid: return
            logger.info(f"Return profile list (SIO) - {[p.name for p in self.profiles]}")
            await self.emit(ev="profilesData", sid=sid, data=[{"name": p.name, "vrm": not p.vrmPath == None} for p in self.profiles])
        
        @self.sio.event
        async def getVRM(sid, pName):
            if not self.client or not self.client.sid == sid: return
            targetProfile = next((profile for profile in self.profiles if profile.name == pName), None)
            if not targetProfile:
                await self.err(err="Profile not found", sid=sid)
                return
            if not targetProfile.vrmPath:
                await self.err(err="Profile has no vrm", sid=sid)
                return
            logger.info(f"Return profile vrm (SIO) - {targetProfile.name}")
            await self.emit(ev="profileVRM", sid=sid, data=targetProfile.vrmPath.read_bytes())
        return socketio.ASGIApp(socketio_server=self.sio, socketio_path="/pa-server/socket.io/")