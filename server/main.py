from typing import Optional
from pydantic import BaseModel, ValidationError
import yaml
from utils import PROJECT_ROOT, loadEnv, logger
loadEnv()

from classes.Server import Server
server = Server()


class ProfileConfig(BaseModel):
    # always required
    name: str
    model: str
    identity: str
    ttsEnabled: bool

    # optional with defaults
    connectedMessage: str = "The user just connected"
    disconnectedMessage: str = "The user disconnected"

    # conditionally required
    referenceText: Optional[str] = None
    referenceTextLang: Optional[str] = None
    inputTextLang: Optional[str] = None
    outputSpeedFactor: Optional[float] = None

    # extra validation rule
    def validate_tts(self):
        if self.ttsEnabled:
            missing = [
                field
                for field in ["referenceText", "referenceTextLang", "inputTextLang", "outputSpeedFactor"]
                if getattr(self, field) is None
            ]
            if missing:
                raise ValueError(f"ttsEnabled is true, but missing required fields: {missing}")




def main():
    import warnings
    import logging
    from rich.traceback import install
    from autogen_core import TRACE_LOGGER_NAME, ROOT_LOGGER_NAME, EVENT_LOGGER_NAME
    warnings.filterwarnings("ignore", category=SyntaxWarning)
    logging.getLogger("mcp.server.streamable_http").setLevel(logging.CRITICAL)
    logging.getLogger("httpx").setLevel(logging.ERROR)
    logging.getLogger(TRACE_LOGGER_NAME).setLevel(logging.WARNING)
    logging.getLogger(ROOT_LOGGER_NAME).setLevel(logging.WARNING)
    logging.getLogger(EVENT_LOGGER_NAME).setLevel(logging.WARNING)
    install()
    
    import asyncio
    async def setup_application():
        global server

        profiles_dir = PROJECT_ROOT / "profiles"
        from classes.Profile import Profile, ProfileSetting, TTSDisabled, TTSEnabled
        for yml_file in profiles_dir.rglob("*.yml"):
            with open(yml_file, "r", encoding="utf-8") as f:
                logger.info(f"Adding profile: {yml_file}")
                data = yaml.safe_load(f) or {}  # avoid None if file is empty

                try:
                    pData = ProfileConfig(**data)
                    pData.validate_tts()
                except ValidationError as e:
                    logger.error("❌ Schema validation failed:")
                    logger.error(e.json(indent=2))
                    continue
                except ValueError as e:
                    logger.error("❌ Conditional validation failed:", e)
                    continue

                audio_file = yml_file.with_suffix(".wav")
                if pData.ttsEnabled and not audio_file.exists():
                    logger.warning(f"No matching audio file for {yml_file.name} (expected {audio_file.name}), disabling TTS.")
                    pData.ttsEnabled = False

                vrm_file = yml_file.with_suffix(".vrm")
                if vrm_file.exists(): logger.info("Profile vrm detected")

                p = Profile(
                    name=pData.name,
                    vrmPath=vrm_file if vrm_file.exists() else None,
                    setting=ProfileSetting(
                        model=pData.model,
                        effort=None,
                        verbosity="medium",
                        allowedTools=None,
                        connectedMessage=pData.connectedMessage,
                        disconnectedMessage=pData.disconnectedMessage,
                        identity=pData.identity,
                        platformAware=True,
                        tts=TTSEnabled(
                            enabled=True,
                            referenceText=pData.referenceText or "",
                            referenceTextLang=pData.referenceTextLang or "",
                            referenceTextPath=audio_file,
                            inputTextLang=pData.inputTextLang or "",
                            outputSpeedFactor=pData.outputSpeedFactor or 1.0
                        ) if pData.ttsEnabled else TTSDisabled(enabled=False)
                    )
                )
                await server.addProfile(p)

        if len(server.profiles) == 0:
            logger.error("No profile registered, terminating process")
            exit(0)

        return server.getApp()

    return asyncio.run(setup_application())

app = main()

if __name__ == "__main__":
    logger.info("Running Server")

    import uvicorn
    import os
    uvicorn.run(
        app,
        port=int(os.getenv("SVR_PORT") or 20000),
        host="0.0.0.0",
        log_level="error"
    )