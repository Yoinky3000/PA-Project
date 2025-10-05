from typing import Literal, Union

from pydantic import BaseModel, TypeAdapter

from .Profile import History

# client to server

class ClientDataMessage(BaseModel):
    type: Literal["clientData"] = "clientData"
    platform: Literal["PC", "terminal", "phone"]
    confirm: bool = False

class LoadProfileMessage(BaseModel):
    type: Literal["loadProfile"] = "loadProfile"
    profile: str

class AddChatMessage(BaseModel):
    type: Literal["addChat"] = "addChat"
    msg: History
    effort: Literal['minimal', 'low', 'medium', 'high'] | None = None
    verbosity: Literal['low', 'medium', 'high'] | None = None

class AddHistoryMessage(BaseModel):
    type: Literal["addHistory"] = "addHistory"
    msg: History

ClientMessage = Union[LoadProfileMessage, AddChatMessage, AddHistoryMessage, ClientDataMessage]
ClientMessageAdapter = TypeAdapter[ClientMessage](ClientMessage)

# server to client

class TextResponse(BaseModel):
    type: Literal["textRes"] = "textRes"
    msg: str

class StreamData(BaseModel):
    txt: str
    audio: bytes | None = None