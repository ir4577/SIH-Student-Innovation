import os
import shutil
import uuid
import csv

from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

####
####  HIGHLY SUGGEST Using python 3.13.X 🙏
####

# Import functions from your existing files
from main import (
    create_pose_landmarker,
    process_video
)

import cv2

app = FastAPI(
    title="Badminton Analysis API",
    description="API for analyzing badminton videos",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories

UPLOAD_DIR = Path("uploads")
DATA_DIR = Path("data")
OUTPUT_DIR = Path("outputs")

UPLOAD_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = "models/pose_landmarker_full.task"


# Health Check
@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Badminton Analysis API is running"
    }


# Video Analysis
@app.post("/analyze")
async def analyze_video(video: UploadFile = File(...)):

    # 1. Validate file
    if not video.filename:
        raise HTTPException(
            status_code=400,
            detail="No video file provided"
        )

    allowed_extensions = {
        ".mp4",
        ".mov",
        ".avi",
        ".mkv"
    }

    extension = Path(video.filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format: {extension}"
        )

    # 2. Create unique ID
    video_id = str(uuid.uuid4())

    input_path = UPLOAD_DIR / f"{video_id}{extension}"
    output_video_path = OUTPUT_DIR / f"{video_id}_annotated.mp4"
    output_csv_path = DATA_DIR / f"{video_id}_pose.csv"

    # 3. Save uploaded video
    try:

        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Could not save uploaded video: {str(e)}"
        )

    # 4. Open video
    cap = cv2.VideoCapture(str(input_path))

    if not cap.isOpened():

        input_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400,
            detail="Could not open uploaded video"
        )

    # 5. Get video information
    width = int(
        cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    )

    height = int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps <= 0:
        fps = 30.0

    # 6. Create output video
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    writer = cv2.VideoWriter(
        str(output_video_path),
        fourcc,
        fps,
        (width, height)
    )

    # 7. Create CSV
    csv_file = open(
        output_csv_path,
        "w",
        newline=""
    )

    csv_writer = csv.writer(csv_file)

    header = ["frame"]

    for landmark_id in range(33):

        header.extend([
            f"landmark_{landmark_id}_x",
            f"landmark_{landmark_id}_y",
            f"landmark_{landmark_id}_z",
            f"landmark_{landmark_id}_visibility"
        ])

    header.extend([
        "left_elbow_angle",
        "right_elbow_angle",
        "left_knee_angle",
        "right_knee_angle"
    ])

    csv_writer.writerow(header)

    # 8. Run MediaPipe
    try:

        if not os.path.exists(MODEL_PATH):

            raise Exception(
                f"Pose model not found: {MODEL_PATH}"
            )

        landmarker = create_pose_landmarker()

        process_video(
            cap,
            writer,
            csv_writer,
            landmarker,
            width,
            height,
            fps
        )

        landmarker.close()

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Pose processing failed: {str(e)}"
        )

    finally:

        cap.release()
        writer.release()
        csv_file.close()

    # 9. Run analysis
    try:

        analysis_result = run_analysis(
            str(output_csv_path)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

    # 10. Return response
    return {
        "status": "success",

        "video_id": video_id,

        "video": {
            "filename": video.filename,
            "width": width,
            "height": height,
            "fps": fps
        },

        "analysis": analysis_result,

        "files": {
            "annotated_video": str(output_video_path),
            "pose_data": str(output_csv_path)
        }
    }

def analyze_smash_form(right_elbow_angle, right_wrist_y, right_shoulder_y):
    feedback = []

    is_arm_raised = right_wrist_y < right_shoulder_y

    if is_arm_raised:
        if right_elbow_angle < 70.0:
            feedback.append("Elbow too bent!")
        elif right_elbow_angle > 160.0:
            feedback.append("Good full extension")
        else:
            feedback.append("Extend arm higher")
    else:
        feedback.append("Ready position")

    return feedback


# Analysis Function
def run_analysis(csv_path):

    import pandas as pd
    import numpy as np
    from scipy.signal import find_peaks

    df = pd.read_csv(csv_path)

    feedback_counts = {}

    for _, row in df.iterrows():
        tips = analyze_smash_form(
            float(row["right_elbow_angle"]),
            float(row["landmark_16_y"]),
            float(row["landmark_12_y"])
        )

        for tip in tips:
            feedback_counts[tip] = feedback_counts.get(tip, 0) + 1

    if df.empty or len(df) < 5:

        return {
            "shots_detected": 0,
            "shots": [],
            "message": "Not enough tracking data to analyze shots."
        }

    FPS = 30.0

    # Smooth elbow angle
    r_elbow_smooth = (
        df["right_elbow_angle"]
        .rolling(
            window=3,
            center=True,
            min_periods=1
        )
        .mean()
        .bfill()
        .ffill()
    )

    # Calculate angular velocity
    elbow_angular_vel = (
        np.gradient(r_elbow_smooth) * FPS
    )

    # Features?
    arm_raised = (
        df["landmark_16_y"] <
        df["landmark_12_y"]
    )

    left_ankle_x = df["landmark_27_x"]
    right_ankle_x = df["landmark_28_x"]

    foot_center_x = (
        left_ankle_x +
        right_ankle_x
    ) / 2.0

    lateral_foot_speed = (
        np.abs(
            np.gradient(foot_center_x) * FPS
        )
    )

    # Detect shots
    peaks, properties = find_peaks(
        elbow_angular_vel,
        height=50.0,
        distance=int(FPS * 0.5)
    )

    shots = []

    arm_position_score = round(
        float(arm_raised.mean()) * 100,
        2
    )

    raised_frames = int(arm_raised.sum())

    if raised_frames > 0:
        full_extension_frames = int(
            ((df["right_elbow_angle"] > 160.0) & arm_raised).sum()
        )

        elbow_extension_score = round(
            (full_extension_frames / raised_frames) * 100,
            2
        )
    else:
        elbow_extension_score = 0.0

    technique_score = round(
        (arm_position_score + elbow_extension_score) / 2,
        2
    )

    strengths = []
    improvements = []



    if feedback_counts.get("Good full extension", 0) > 0:
        strengths.append(
            "Good full extension during the overhead movement"
        )

    if feedback_counts.get("Elbow too bent!", 0) > 0:
        improvements.append(
            "Try extending your elbow more during the swing"
        )

    if feedback_counts.get("Extend arm higher", 0) > 0:
        improvements.append(
            "Try raising your arm higher during preparation"
        )

    # Classify each shot
    for idx, peak_idx in enumerate(peaks, 1):

        row = df.loc[peak_idx]

        velocity = float(
            elbow_angular_vel[peak_idx]
        )

        angle = float(
            row["right_elbow_angle"]
        )

        is_raised = bool(
            arm_raised.iloc[peak_idx]
        )

        frame_num = int(
            row["frame"]
        )

        # Same classification logic, currently used in analyse.py

        if (
            velocity > 250.0
            and angle > 140.0
            and is_raised
        ):

            classification = "Smash / Power Clear"

        elif (
            100.0 < velocity <= 250.0
            and is_raised
        ):

            classification = "Drop Shot / Soft Overhead"

        elif (
            velocity > 150.0
            and not is_raised
        ):

            classification = "Drive / Underarm Lift"

        else:

            classification = "Push / Block"

        shots.append({
            "shot_number": idx,
            "frame": frame_num,
            "peak_speed": round(velocity, 2),
            "elbow_angle": round(angle, 2),
            "classification": classification
        })

    # Return structured result
    return {
        "total_frames": len(df),
        "duration_seconds": round(len(df) / FPS, 2),
        "average_lateral_foot_speed": round(float(lateral_foot_speed.mean()), 4),
        "shots_detected": len(shots),
        "shots": shots,
        "techniqueScore": technique_score,
        "metrics": {
            "armPosition": arm_position_score,
            "elbowExtension": elbow_extension_score
        },

        "feedback": {
            "strengths": strengths,
            "improvements": improvements
        }
    }