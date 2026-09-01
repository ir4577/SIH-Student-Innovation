import pandas as pd
import numpy as np
import warnings
from scipy.signal import find_peaks

warnings.simplefilter(action="ignore", category=pd.errors.PerformanceWarning)

# ---------------------------------------------------------
# Configuration & Data Loading
# ---------------------------------------------------------
CSV_FILE = "data/pose_data.csv"
FPS = 30.0

df = pd.read_csv(CSV_FILE)

if df.empty or len(df) < 5:
    print("Not enough tracking data to analyze shots.")
    exit()

# ---------------------------------------------------------
# Feature Extraction
# ---------------------------------------------------------
r_elbow_smooth = (
    df["right_elbow_angle"]
    .rolling(window=3, center=True, min_periods=1)
    .mean()
    .bfill()
    .ffill()
)

elbow_angular_vel = np.gradient(r_elbow_smooth) * FPS
r_wrist_y = df["landmark_16_y"]
arm_raised = df["landmark_16_y"] < df["landmark_12_y"]

left_ankle_x = df["landmark_27_x"]
right_ankle_x = df["landmark_28_x"]
foot_center_x = (left_ankle_x + right_ankle_x) / 2.0
lateral_foot_speed = np.abs(np.gradient(foot_center_x) * FPS)

df = df.assign(
    r_elbow_smooth=r_elbow_smooth,
    elbow_angular_vel=elbow_angular_vel,
    r_wrist_y=r_wrist_y,
    arm_raised=arm_raised,
    lateral_foot_speed=lateral_foot_speed
)

# ---------------------------------------------------------
# Multi-Shot Peak Detection Algorithm
# ---------------------------------------------------------
# Locate acceleration spikes (minimum 15 frames / 0.5s apart)
peaks, properties = find_peaks(
    df["elbow_angular_vel"], 
    height=50.0,      # Minimum angular speed to consider a swing
    distance=int(FPS * 0.5)  # Minimum spacing between shots
)

print("=" * 55)
print("     BADMINTON RALLY MULTI-SHOT ANALYSIS REPORT")
print("=" * 55)
print(f"Total Frames Analyzed  : {len(df)} ({len(df)/FPS:.2f} seconds)")
print(f"Avg Lateral Foot Speed : {df['lateral_foot_speed'].mean():.4f} units/s")
print("-" * 55)

if len(peaks) == 0:
    print("No distinct stroke impact peaks detected.")
    print("Current phase: Stance / Preparation / Defensive Block")
else:
    print(f"Total Shots Detected   : {len(peaks)}\n")
    print(f"{'Shot #':<8}{'Frame':<10}{'Peak Speed':<18}{'Shot Classification'}")
    print("-" * 55)

    for idx, peak_idx in enumerate(peaks, 1):
        row = df.loc[peak_idx]
        vel = row["elbow_angular_vel"]
        angle = row["r_elbow_smooth"]
        is_raised = row["arm_raised"]
        frame_num = int(row["frame"])

        # Classification logic
        if vel > 250.0 and angle > 140.0 and is_raised:
            classification = "Smash / Power Clear"
        elif 100.0 < vel <= 250.0 and is_raised:
            classification = "Drop Shot / Soft Overhead"
        elif vel > 150.0 and not is_raised:
            classification = "Drive / Underarm Lift"
        else:
            classification = "Push / Block"

        print(f"{idx:<8}{frame_num:<10}{vel:<18.2f}{classification}")

print("=" * 55)
