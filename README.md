# 🧠 Personal Assistant (PA)

A **AI-powered assistant** that runs in your computer — supporting **text-based chat**, **text-to-speech (TTS)** via [GPT SOVIT](https://github.com/RVC-Boss/GPT-SoVITS), **VRM model display** for a lively, anime-style virtual companion, and performing tasks in your computer.

---

## 🚀 Overview

The **Personal Assistant (PA)** project lets you interact with your own PA through a web client.
It supports:

* Conversational AI using **ChatGPT API**
* **Voice synthesis** (TTS) powered by **[GPT SOVIT](https://github.com/RVC-Boss/GPT-SoVITS)**
* **VRM avatar display** via Three.js
* Multiple PA profiles with custom personalities and settings

Each profile can define:

* Identity
* ChatGPT model configuration
* Optional TTS integration

---

## 🧩 Features

- ✅ **ChatGPT integration** — customizable models per profile
- ✅ **TTS support** — generate natural voice from text (via GPT SOVIT)
- ✅ **VRM display** — show an interactive 3D avatar
- ✅ **Profile system** — multiple assistants, each with their own voice, model, and appearance

---

## 🧰 Requirements

Before setup, make sure you have the following installed:

| Dependency             | Recommended Version | Notes                                      |
| ---------------------- | ------------------- | ------------------------------------------ |
| **Python**             | 3.11.9              | preferably with **uv** as package manager  |
| **Node.js**            | Latest LTS          | preferably with **yarn** as package manager|
| **GPT SOVIT** (API V2) | —                   |                                            |
| **OpenAI API key**     | —                   |                                            |

---

## 🧑‍💻 Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/Yoinky3000/PA-Project.git
   cd PA-Project
   ```

2. **Install Python dependencies**
   *(using [uv](https://github.com/astral-sh/uv), recommended)*

   ```bash
   uv sync
   ```

3. **Install Node.js dependencies**

   ```bash
   yarn install
   ```

4. **Add your API keys**

   * Rename `.env.template` to `.env`, and set your **ChatGPT API key** in `OPENAI_API_KEY` in the `.env`.
   * Make sure **GPT SOVIT API v2** is running if you plan to use TTS.

---

## ⚙️ Profile Configuration

Profiles are stored in:

```
profiles/
```

The default configuration file is:

```
profiles/default.yml
```

You can create additional profiles by adding more `.yml` files to the same folder:

```
profileA.yml
profileB.yml
```

Each profile `.yml` defines:

* **Identity / personality**
* **ChatGPT model**
* **TTS settings**

### 🔊 Enabling TTS

To enable text-to-speech for a profile:

1. Set `ttsEnabled: true` in your profile `.yml`.
2. Provide a reference audio file (`.wav`) **with the same filename** as the profile.
   Example:

   ```
   profiles/profileA.yml
   profiles/profileA.wav
   ```

### 🧍‍♀️ Enabling VRM Display

To enable VRM model display:

1. Place a `.vrm` file with the same name next to your profile file.
   Example:

   ```
   profiles/profileA.yml
   profiles/profileA.vrm
   ```

---

## ⚠️ IMPORTANT

### Reference audio files ***must be shorter than 10 seconds*** due to GPT SOVIT TTS limitations.

---

## ▶️ Running the Project

1. **Start the backend server**

   ```bash
   yarn server
   ```

2. **Start the web client**

   ```bash
   yarn web
   ```

3. *(Optional)* **Run GPT SOVIT API v2**, 
   This is required **if TTS is enabled** in your active profile.

4. **Open the web client** in your browser and:

   * Connect to the server
   * Select a profile from the list
   * Start interaction with your PA

---

## 💬 Chat History

All the chat history can be found inside `drive/` folder

---

## 💡 Example Folder Structure

```
PA-Project/
├── drive/
├── profiles/
│   ├── default.yml
│   ├── default.wav
│   ├── profileA.yml
│   ├── profileA.vrm
│   ├── profileB.yml
│   ├── profileB.wav
│   └── profileB.vrm
├── .env.template -> .env
└── ...
```

---

## 🧠 Future Plans

* Custom **emotion-based VRM animation**
* **Voice activity detection** for real-time conversations
* Integration with productivity tools (VSCode, Notion, etc.)
* Add support for performing tasks in the computer
* Extend the web client to Unity based client for better performance and display result

---

## 📝 License

MIT License © 2025 Yoinky3000
