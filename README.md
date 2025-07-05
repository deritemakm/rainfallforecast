# 🌧️ Rainfall Forecasting Neural Network with Grokking

This project forecasts rainfall per municipality using a neural network and public weather data. It uses a simple web frontend and a FastAPI backend.

---

## 📦 Requirements

- Python 3.9 or higher
- `pip` (comes with Python)
- Internet connection (for fetching weather data)
- **(Optional)** Git (to clone the repo)
- **No need to install anything else manually!**

---

## 🚀 Getting Started

### ✅ Option 1: Easiest Setup (for Windows users)

> ⚠️ Recommended for most users.

1. **Download or clone** this repository:
```bash
git clone https://github.com/deritemakm/rainfallforecast.git
```
Or just download the ZIP and extract it.

2. **Open the folder**, then **double-click `setup.bat`**.

3. When it finishes, open your browser and go to:

```
http://127.0.0.1:8000/index.html
```

🎉 You're done!

---

### 🛠️ Option 2: Run Manually via Terminal

If you want to run it through your terminal (PowerShell, CMD, Bash):

#### **1. Open a terminal and go to the folder**
```bash
cd rainfallforecast
```

#### **2. Run the script based on your terminal:**

---

### 🔹 PowerShell
```powershell
# Allow script to run
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Run setup
.\setup.bat
```

---

### 🔹 CMD or VSCode
```cmd
setup.bat
```

---

### 🔹 Linux / macOS / WSL
```bash
chmod +x setup.sh
./setup.sh
```

---

## 🌐 After Running Setup

Once the server is running, open your browser and go to:
```
http://127.0.0.1:8000
```
⚠️ **Don't close the terminal while the server is running!**

- Closing the terminal = stopping the server.
- Keep it open while you're using the site (http://127.0.0.1:8000).
- To stop the server manually, press `Ctrl + C`.


---

## 🧠 Notes

- This sets up a virtual environment for you automatically.
- You **don't need to install FastAPI or anything manually**.
- If you stop the server and want to run again, you can just run double-click on `run.bat` or manually:
```powershell
# (run command based on terminal)
.\run.bat # Windows (PowerShell)
run.bat # Windows (CMD or VSCode)
./run.sh # WSL/Linux/macOS
```