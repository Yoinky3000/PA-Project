from classes.Agent import Agent, agentClient
from autogen_agentchat.agents import AssistantAgent
from utils import DRIVE_PATH


class FileSystemAgent(Agent):
    def __init__(self) -> None:
        super().__init__(AssistantAgent(
        "file_system_handler",
        system_message="""You are a file system agent, according to provided info, utilize given tool to perform file related action""",
        description="A file assistant that perform file operation.",
        model_client=agentClient,
        tools=[self.createFile],
        max_tool_iterations=100,
    ))
    def createFile(self, content: str, fileName: str):
        with open(DRIVE_PATH / fileName, "w", encoding="utf-8") as f:
            f.write(content)
        return f"File '{DRIVE_PATH / fileName}' created."