import os
import re
import time
from typing import Annotated
from openai import AsyncOpenAI
from openai.types.responses import EasyInputMessageParam
from classes.Agent import Agent, agentClient
from autogen_agentchat.agents import AssistantAgent
from httpx import AsyncClient
from utils import genTTSAudio, logger, outputClean

from .fileSystemAgent import FileSystemAgent

http_client = AsyncClient(http2=True, timeout=30.0)

paGuidance = "\nAn Agent will help you to perform different task, including file, if you want to perform such task, you have to include the term \"TASK\" after your respond to the user, and mention the task you want to perform with all relevant information of the task after the \"TASK\". For example, to create a file, you need to provide the filename, and the  exact content of the file that you want the file to contain, the task content can be delivered in your own style. Depends on the context you can provide the info on your own and not requiring user to provide it for you. Anything after the \"TASK\" will not show to the user. And anything before the \"TASK\" is your actual respond to the user, and will show to the user, such content should not contain anything that cannot be spoken, like emoji, code, any kind of formatting, listing, etc. Keep your response for the user in sentences only. You can also react to user base on the time info provided if appropriate. As a tsundere, you can choose to ignore what user asked."

class MasterAgent(Agent):
    def __init__(self) -> None:

        self.fileSystemAgent = FileSystemAgent()
        super().__init__(AssistantAgent(
            "main_handler",
            system_message="""
You are the main handler of an assistant
When you receive user message, you have to pass the message to the assistant with addResponse tool, telling the assistant what I(user) sent, and you will receive the respond from the assistant.
If the language user sent is not in english, convert it to english first, so that the assistant will respond in english.
If the response from the assistant include the word "TASK", then content after "TASK" is considered as what the assistant want to perform. Otherwise, that means the assistant don't want to perform the task.
If the assistant choose to perform the task, then you can start calling related agent tool to perform the task. And you should use addResponse if the current response of the assistant is not completed yet.
If there is a task that you have no agent or tools to perform, tell the assistant.
Do not repeatedly triggering response from the assistant unless necessary.

When you respond to the user, you dont need to include any explanation or description, just return "DONE"
    """,
            model_client=agentClient,
            tools=[self.fileSystemAgent.tool, self.addResponse],
            max_tool_iterations=100,
        ))
        self.openai = AsyncOpenAI(
            base_url=os.getenv("OPENAI_URL"),
            api_key=os.getenv("OPENAI_API_KEY"),
            http_client=http_client
        )
        
    def setServer(self, server):
        self.fileSystemAgent.setServer(server=server)
        return super().setServer(server)
    def setProfile(self, profile):
        self.fileSystemAgent.setProfile(profile=profile)
        return super().setProfile(profile)
    async def addResponse(self, payload: Annotated[str, "the message pass to the assistant"]):
        from classes.Profile import History
        setting = self.profile.setting
        self.profile.addHistory(History(role="developer", name="Agent", content=payload))
        # self.profile.addHistory.append(EasyInputMessageParam(content=f'> Sent at {getHKT()}\n{payload}', role="developer"))
        input = [EasyInputMessageParam(role="system",content=setting.identity+paGuidance)] + self.profile.getRecentHistory()
        stream = await self.openai.responses.create(
            stream=True,
            model=setting.model,
            store=False,
            reasoning={"effort": setting.effort},
            text={"verbosity": setting.verbosity},
            parallel_tool_calls=True,
            service_tier="priority",
            user="User",
            input=input
        )
        start_time = time.perf_counter()

        finalText = ""
        async def oaiStream():
            from classes.SIOData import StreamData
            nonlocal finalText
            firstDelta = False
            taskDetected = False
            buffer = ""
            bufferDeltaSize = 0
            try:
                async for chunk in stream:
                    if chunk.type == "response.output_text.delta":
                        if not firstDelta:
                            first_delta_time = time.perf_counter()
                            ttfd = first_delta_time - start_time
                            logger.info(f"Time to first delta: {ttfd:.3f} seconds")
                            firstDelta = True
                        textChunk = chunk.delta
                        finalText += textChunk
                        if textChunk == "TASK":
                            logger.info("Task Detected")
                            taskDetected = True
                        if not taskDetected:
                            if self.profile.setting.tts.enabled == True:
                                ttsSetting = self.profile.setting.tts
                                if bufferDeltaSize > 15 and re.compile(r"[.!?。！？]$").search(buffer):
                                    audio = await genTTSAudio(inputText=buffer, inputLang="en", refText=ttsSetting.referenceText, refLang=ttsSetting.referenceTextLang, refPath=ttsSetting.referenceTextPath, speed=ttsSetting.outputSpeedFactor, tokenSize=bufferDeltaSize)
                                    yield StreamData(txt=buffer, audio=audio)
                                    buffer = ""
                                    bufferDeltaSize = 0
                                buffer += textChunk
                                bufferDeltaSize += 1
                            else: yield StreamData(txt=textChunk)
                        elif len(outputClean(buffer)) > 0 and self.profile.setting.tts.enabled == True:
                            ttsSetting = self.profile.setting.tts
                            audio = await genTTSAudio(inputText=buffer, inputLang="en", refText=ttsSetting.referenceText, refLang=ttsSetting.referenceTextLang, refPath=ttsSetting.referenceTextPath, speed=ttsSetting.outputSpeedFactor, tokenSize=bufferDeltaSize)
                            yield StreamData(txt=buffer, audio=audio)
                            buffer = ""
                            bufferDeltaSize = 0
                    elif chunk.type == "response.completed":
                        if chunk.response.usage: logger.info(chunk.response.usage.model_dump())
                if len(outputClean(buffer)) > 0 and self.profile.setting.tts.enabled == True:
                    ttsSetting = self.profile.setting.tts
                    audio = await genTTSAudio(inputText=buffer, inputLang="en", refText=ttsSetting.referenceText, refLang=ttsSetting.referenceTextLang, refPath=ttsSetting.referenceTextPath, speed=ttsSetting.outputSpeedFactor, tokenSize=bufferDeltaSize)
                    yield StreamData(txt=buffer, audio=audio)
                    buffer = ""
                    bufferDeltaSize = 0
            except Exception as e:
                logger.error(e)
            finally:
                pass
        await self.server.streamDelta(stream=oaiStream())
        self.profile.addHistory(History(role="assistant", name="you", content=finalText))
        await self.profile.saveHistory()
        return finalText