from pathlib import Path
from typing import Annotated, List, Literal, Optional, Union
from openai.types.responses import EasyInputMessageParam, ResponseInputParam
from pydantic import BaseModel, Field
from utils import getHKT, loadJson, writeJson, DRIVE_PATH
from agents.masterAgent import MasterAgent

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .Server import Server

class History(BaseModel):
    deepDive: Optional[Literal["start", "end"]] = None
    name: str
    time: str = Field(default_factory=getHKT)
    role: Literal['user', 'assistant', 'system', 'developer']
    content: str

class TTSDisabled(BaseModel):
    enabled: Literal[False]


class TTSEnabled(BaseModel):
    enabled: Literal[True]
    referenceText: str
    referenceTextLang: str
    referenceTextPath: Path
    inputTextLang: str
    outputSpeedFactor: float = 1.0

TTSSetting = Annotated[Union[TTSDisabled, TTSEnabled], Field(discriminator="enabled")]

class ProfileSetting(BaseModel):
    identity: str
    model: str
    effort: Literal['minimal', 'low', 'medium', 'high'] | None
    verbosity: Literal['low', 'medium', 'high'] | None
    allowedTools: List[str] | None
    platformAware: bool = False
    connectedMessage: str
    disconnectedMessage: str
    tts: TTSSetting

class Profile:
    def __init__(
            self,
            name: str,
            vrmPath: Path | None,
            setting: ProfileSetting
        ):
        self.name = name
        self.setting = setting
        self.history: List[History] = []
        self.masterAgent = MasterAgent()
        self.server: Server
        self.historyFile = DRIVE_PATH / "profiles" / self.name / f"history.json"
        self.vrmPath = vrmPath

    async def setup(self, server):
        self.server = server
        self.masterAgent.setProfile(self)
        self.masterAgent.setServer(self.server)
        await self.loadHistory()

    async def addChat(self, msg: History):
        self.addHistory(msg)
        await self.saveHistory()
        await self.masterAgent.instance.run(task=f"The user asked:\n{msg}")
        await writeJson(DRIVE_PATH / "InnerHistory.json", self.history)
        self.history = [h for h in self.history if not h.name == "Agent"]
        await self.saveHistory()

    async def connect(self, continueChat: bool):
        if any(h.content == "" for h in self.history):
            self.history = [h for h in self.history if h.content != ""]
        if not continueChat and self.setting.connectedMessage:
            self.addHistory(History(role="developer", name="System", content=self.setting.connectedMessage))
        await self.saveHistory()

    async def disconnect(self):
        if any(h.content == "" for h in self.history):
            self.history = [h for h in self.history if h.content != ""]
        if self.setting.disconnectedMessage:
            self.addHistory(History(role="developer", name="System", content=self.setting.disconnectedMessage))
        await self.saveHistory()

    def addHistory(self, content: History):
        self.history.append(content)

    async def loadHistory(self):
        self.history = await loadJson(self.historyFile, self.history, History)
        if any(h.content == "" for h in self.history):
            self.history = [h for h in self.history if h.content != ""]
    async def saveHistory(self):
        await writeJson(self.historyFile, self.history)
        
    def getRecentHistory(self, limit: int = 50) -> ResponseInputParam:
        validHistory = self.history if not any(h.content == "" for h in self.history) else [h for h in self.history if h.content != ""]
        res: ResponseInputParam = []
        i = 0
        start_count = sum(1 for message in validHistory if message.deepDive == "start")
        end_count = sum(1 for message in validHistory if message.deepDive == "end")
        deepDive = True if start_count > end_count else False
        for history in validHistory[::-1]:
            if (i >= limit and not deepDive): break
            if (history.deepDive == "start"): deepDive = False
            elif (history.deepDive == "end"): deepDive = True
            firstLine = ""
            formatted_content = history.content
            if history.role != "assistant":
                isDeep = ""
                if (history.deepDive == "start"): isDeep = "[START OF DEEP CONVERSATION] "
                elif (history.deepDive == "end"): isDeep = "[END OF DEEP CONVERSATION] "
                firstLine += f"> {isDeep}Sent at {history.time}"
                if history.role == "developer": firstLine += f" From \"{history.name}\""
                formatted_content = f"{firstLine}\n{formatted_content}"
            
            res.append(EasyInputMessageParam(
                role=history.role,
                content=formatted_content,
            ))
            i += 1
        res.reverse()
        return res