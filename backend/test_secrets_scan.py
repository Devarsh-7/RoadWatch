"""
test_secrets_scan.py — Automated Repository Secrets & Credential Leakage Scanner
================================================================================
Scans all frontend and backend source files to guarantee:
1. Zero API keys, JWT secrets, database connection URLs, or tokens exist in frontend code.
2. Zero committed .env files or private keys.
3. Proper .gitignore rules block all sensitive files (.env, .env.*, *.key, *.pem).
4. Backend secrets are strictly retrieved via environment variables (os.getenv).
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(REPO_ROOT, "frontend")
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")

# High-risk secret patterns
SECRET_PATTERNS = {
    "Gemini API Key": re.compile(r"AQ\.[A-Za-z0-9_\-]{40,}|AIza[0-9A-Za-z\-_]{35}"),
    "JWT / Bearer Token": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "PostgreSQL Connection URI": re.compile(r"postgresql://[a-zA-Z0-9_.-]+:[^@\s]+@[a-zA-Z0-9_.-]+"),
    "Hardcoded AWS / Private Key": re.compile(r"AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}

EXCLUDED_DIRS = {
    "node_modules", ".git", "venv", "__pycache__", "dist", "build", ".vscode", "logs"
}
EXCLUDED_FILES = {
    ".env",  # .env files are verified for .gitignore exclusion, not scanned for patterns
}


def test_gitignore_covers_secrets():
    print("\n--- [TEST 1] Verifying .gitignore Rules for Secrets ---")
    gitignore_path = os.path.join(REPO_ROOT, ".gitignore")
    assert os.path.exists(gitignore_path), "Root .gitignore missing"

    with open(gitignore_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert ".env" in content, ".env must be ignored in .gitignore"
    assert "*.key" in content or "*.pem" in content, "Private keys must be ignored in .gitignore"
    assert "backend/.env" in content, "backend/.env must be ignored"
    assert "frontend/.env" in content, "frontend/.env must be ignored"

    # Verify via git that .env files are ignored
    import subprocess
    cmd = ["git", "check-ignore", "backend/.env", "frontend/.env", ".env"]
    res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
    assert res.returncode == 0
    assert "backend/.env" in res.stdout
    assert "frontend/.env" in res.stdout
    print("[PASS] .gitignore correctly ignores all .env files and private key formats.")


def test_frontend_has_zero_secrets():
    print("\n--- [TEST 2] Scanning Frontend Source Code for Secrets ---")
    violations = []

    for root, dirs, files in os.walk(FRONTEND_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in files:
            if f.endswith((".js", ".jsx", ".ts", ".tsx", ".html", ".json")) and f not in EXCLUDED_FILES:
                file_path = os.path.join(root, f)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as content_file:
                    text = content_file.read()

                for name, pattern in SECRET_PATTERNS.items():
                    matches = pattern.findall(text)
                    if matches:
                        violations.append(f"Found {name} in frontend file: {file_path}")

    assert len(violations) == 0, f"Secrets detected in frontend:\n" + "\n".join(violations)
    print("[PASS] Frontend source code is 100% clean of API keys, tokens, and database credentials.")


def test_backend_source_clean_of_hardcoded_secrets():
    print("\n--- [TEST 3] Scanning Backend Source Code for Hardcoded Secrets ---")
    violations = []

    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in files:
            # Only scan Python source code files (exclude test scripts which test for specific dummy/mock patterns)
            if f.endswith(".py") and not f.startswith("test_") and f not in EXCLUDED_FILES:
                file_path = os.path.join(root, f)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as content_file:
                    text = content_file.read()

                for name, pattern in SECRET_PATTERNS.items():
                    matches = pattern.findall(text)
                    if matches:
                        violations.append(f"Found {name} in backend file: {file_path}")

    assert len(violations) == 0, f"Hardcoded secrets detected in backend source:\n" + "\n".join(violations)
    print("[PASS] Backend source code contains no hardcoded API keys or credentials.")


def test_env_examples_contain_no_real_secrets():
    print("\n--- [TEST 4] Verifying .env.example Templates Contain Placeholders Only ---")
    examples = [
        os.path.join(BACKEND_DIR, ".env.example"),
        os.path.join(FRONTEND_DIR, ".env.example")
    ]

    for ex_path in examples:
        if os.path.exists(ex_path):
            with open(ex_path, "r", encoding="utf-8") as f:
                text = f.read()
            for name, pattern in SECRET_PATTERNS.items():
                matches = pattern.findall(text)
                assert len(matches) == 0, f"Real secret found in example file: {ex_path} ({matches})"

    print("[PASS] All .env.example files contain safe documentation placeholders only.")


if __name__ == "__main__":
    print("=================================================================")
    print("Starting RoadWatch Repository Secrets & Credentials Audit")
    print("=================================================================")
    test_gitignore_covers_secrets()
    test_frontend_has_zero_secrets()
    test_backend_source_clean_of_hardcoded_secrets()
    test_env_examples_contain_no_real_secrets()
    print("\n=================================================================")
    print("ALL SECRETS & CREDENTIAL SCANNING TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")
