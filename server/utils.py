import asyncio
from datetime import datetime
import json
from pathlib import Path
import re
from typing import List, TypeVar, Union, overload
from dotenv import load_dotenv
from pydantic import BaseModel, TypeAdapter
import pytz

async def writeJson(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    def write_file():
        with path.open("w", encoding="utf-8") as f:
            if isinstance(data, BaseModel):
                json.dump(data.model_dump(), f, indent=2, ensure_ascii=False)
            elif isinstance(data, list) and all(isinstance(x, BaseModel) for x in data):
                json.dump([x.model_dump() for x in data], f, indent=2, ensure_ascii=False)
            else:
                json.dump(data, f, indent=2, ensure_ascii=False)
    await asyncio.to_thread(write_file)

T = TypeVar("T", bound=BaseModel)

@overload
async def loadJson(path: Path, defaultData: T, modelClass) -> T: ...
@overload
async def loadJson(path: Path, defaultData: List[T], modelClass: type[T]) -> List[T]: ...

async def loadJson(path: Path, defaultData: Union[T, List[T]], modelClass: type[T]) -> Union[T, List[T]]:
    if not path.exists():
        await writeJson(path=path, data=defaultData)
        return defaultData

    def read_file():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    try:
        data_dict = await asyncio.to_thread(read_file)

        if isinstance(defaultData, list):
            model_type = modelClass
            adapter = TypeAdapter(List[model_type])
        else:
            model_type = defaultData.__class__
            adapter = TypeAdapter(model_type)

        return adapter.validate_python(data_dict)

    except json.JSONDecodeError:
        logger.info("Error decoding JSON, initializing with default data.")
        await writeJson(path=path, data=defaultData)
        return defaultData

def outputClean(text: str) -> str:
    text = text.replace('-', ' ').replace('’', "'").replace('—', ", ").lower()
    text = re.sub(r'\([^)]*\)', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

async def genTTSAudio(inputText: str, inputLang: str, refPath: Path, refText: str, refLang: str, speed: float, tokenSize: int) -> bytes | None:
    import httpx
    try:
        BASE_URL = "http://127.0.0.1:9880/tts"
        payload = {
            "text": outputClean(inputText),
            "text_lang": inputLang,
            "ref_audio_path": str(refPath),
            "aux_ref_audio_paths": [],
            "prompt_text": refText,
            "prompt_lang": refLang,
            "top_k": 15,
            "top_p": 1,
            "temperature": 1,
            "text_split_method": "cut4",
            # "batch_size": 1,
            # "batch_threshold": 0.75,
            # "split_bucket": True,
            "speed_factor": speed,
            "streaming_mode": False,
            # "seed": -1,
            "parallel_infer": True,
            # "repetition_penalty": 1.35,
            # "sample_steps": 32,
            # "super_sampling": False,
        }

        logger.info(f"Fetching GPT SoVITS ({tokenSize} tokens)...")
        timeout = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(BASE_URL, json=payload)
            if resp.status_code == 200:
                return resp.content
            else:
                logger.error("Fetch failed: %s %s", resp.status_code, resp.text)
                return None
    except Exception as e:
        logger.error(repr(e))
        return None


def getHKT() -> str:
    hkt_timezone = pytz.timezone('Asia/Hong_Kong')
    now_hkt = datetime.now(hkt_timezone)
    return now_hkt.strftime("%Y-%m-%d %H:%M:%S %Z%z")

def loadEnv():
    load_dotenv(dotenv_path=PROJECT_ROOT / '.env')


PROJECT_ROOT = Path(__file__).resolve().parent.parent  # /root/py-src/.. → /root

DRIVE_PATH = PROJECT_ROOT / "drive"
DRIVE_PATH_STR = str(DRIVE_PATH)

import logging
from rich.logging import RichHandler
FORMAT = "%(message)s"
logging.basicConfig(
    level="INFO",
    format=FORMAT,
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)
logger = logging.getLogger()