python - <<'PY'
import cv2
import glob
import os

videos = glob.glob(
    "VideoBadminton_Dataset/**/*.mp4",
    recursive=True
)

results = []

for i, video_path in enumerate(videos):

    cap = cv2.VideoCapture(video_path)

    frames = int(
        cap.get(cv2.CAP_PROP_FRAME_COUNT)
    )

    fps = cap.get(cv2.CAP_PROP_FPS)

    cap.release()

    if fps > 0 and frames > 0:

        duration = frames / fps

        results.append(
            (duration, frames, fps, video_path)
        )

    if (i + 1) % 500 == 0:
        print(
            f"Checked {i + 1} / {len(videos)} videos"
        )


results.sort(reverse=True)

print("\nTOP 20 LONGEST VIDEOS\n")

for duration, frames, fps, path in results[:20]:

    print(
        f"{duration:.2f}s | "
        f"{frames} frames | "
        f"{path}"
    )
PY
