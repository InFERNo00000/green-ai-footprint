#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run build

python -m pip install --upgrade pip
pip install -r requirements.txt
