# Masjid As-Sunnah, GitHub Prayer Sync

The approved homepage design is preserved. Prayer and iqamah values now come from the masjid's existing MosquePrayerTimes schedule.

## Data flow

MosquePrayerTimes → GitHub Action parser → `data/prayer-times.json` → existing homepage

## GitHub setup

1. Upload the project to your repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, then select `main` and `/ (root)`.
4. Open **Settings → Actions → General**.
5. Under Workflow permissions, choose **Read and write permissions**.
6. Open **Actions → Update prayer times → Run workflow** for the first live update.

The workflow runs every three hours. If parsing fails, the previous valid JSON schedule remains unchanged.

## Important files

- `.github/workflows/update-prayer-times.yml`
- `scripts/fetch-prayer-times.py`
- `data/prayer-times.json`
- `js/prayer-times.js`
