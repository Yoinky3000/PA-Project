from autogen_ext.models.openai import OpenAIChatCompletionClient
from httpx import AsyncClient

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.tools import AgentTool
import os

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .Profile import Profile
    from .Server import Server

http_client = AsyncClient(http2=True, timeout=30.0,)

agentClient = OpenAIChatCompletionClient(model="gpt-4.1-mini", api_key=os.getenv("OPENAI_API_KEY") or "", base_url=os.getenv("OPENAI_URL") or "", parallel_tool_calls=True)

class Agent:
    def __init__(self, agent: AssistantAgent) -> None:
        self.profile: Profile
        self.server: Server
        self.instance = agent
        self.tool = AgentTool(agent)
    def setServer(self, server):
        self.server = server
    def setProfile(self, profile):
        self.profile = profile