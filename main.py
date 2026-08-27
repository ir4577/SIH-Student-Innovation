import cv2
import csv
import os
import numpy as np

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
INPUT_VIDEO = (
    "VideoBadminton_Dataset/14_Smash/"
    "2022-08-30_18-00-09_dataset_set1_022_002091_002108_A_14.mp4")
OUTPUT_VIDEO = "data/pose_output.mp4"
OUTPUT_CSV = "data/pose_data.csv"

MODEL_PATH = "models/pose_landmarker_full.task"
# ---------------------------------------------------------
# MediaPipe Landmark IDs
# ---------------------------------------------------------

LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12

LEFT_ELBOW = 13
RIGHT_ELBOW = 14

LEFT_WRIST = 15
RIGHT_WRIST = 16

LEFT_HIP = 23
RIGHT_HIP = 24

LEFT_KNEE = 25
RIGHT_KNEE = 26

LEFT_ANKLE = 27
RIGHT_ANKLE = 28

# ---------------------------------------------------------
# Create Pose Landmarker
# ---------------------------------------------------------

def create_pose_landmarker():

    base_options = python.BaseOptions(
        model_asset_path=MODEL_PATH
    )

    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.PoseLandmarker.create_from_options(
        options
    )

# ---------------------------------------------------------
# Calculate Angle Between Three Points
# ---------------------------------------------------------

def calculate_angle(point_a, point_b, point_c):

    a = np.array(point_a)
    b = np.array(point_b)
    c = np.array(point_c)

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(
        ba,
        bc
    ) / (
        np.linalg.norm(ba)
        * np.linalg.norm(bc)
    )

    cosine_angle = np.clip(
        cosine_angle,
        -1.0,
        1.0
    )

    angle = np.degrees(
        np.arccos(cosine_angle)
    )

    return angle

# ---------------------------------------------------------
# Process Video
# ---------------------------------------------------------
# ---------------------------------------------------------
# Process Video
# ---------------------------------------------------------

def process_video(
    cap,
    writer,
    csv_writer,
    landmarker,
    width,
    height,
    fps
):

    frame_number = 0

    while True:

        success, frame = cap.read()

        if not success:
            break

        # -------------------------------------------------
        # Convert BGR to RGB
        # -------------------------------------------------

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        # -------------------------------------------------
        # Convert frame to MediaPipe image
        # -------------------------------------------------

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        # -------------------------------------------------
        # Calculate timestamp
        # -------------------------------------------------

        timestamp_ms = int(
            frame_number * 1000 / fps
        )

        # -------------------------------------------------
        # Detect pose
        # -------------------------------------------------

        result = landmarker.detect_for_video(
            mp_image,
            timestamp_ms
        )

        # -------------------------------------------------
        # Process detected pose
        # -------------------------------------------------

        if result.pose_landmarks:

            landmarks = result.pose_landmarks[0]

            # ---------------------------------------------
            # Get landmark coordinates
            # ---------------------------------------------

            def point(landmark_id):

                landmark = landmarks[landmark_id]

                return [
                    landmark.x,
                    landmark.y
                ]

            # ---------------------------------------------
            # Calculate joint angles
            # ---------------------------------------------

            left_elbow_angle = calculate_angle(
                point(LEFT_SHOULDER),
                point(LEFT_ELBOW),
                point(LEFT_WRIST)
            )

            right_elbow_angle = calculate_angle(
                point(RIGHT_SHOULDER),
                point(RIGHT_ELBOW),
                point(RIGHT_WRIST)
            )

            left_knee_angle = calculate_angle(
                point(LEFT_HIP),
                point(LEFT_KNEE),
                point(LEFT_ANKLE)
            )

            right_knee_angle = calculate_angle(
                point(RIGHT_HIP),
                point(RIGHT_KNEE),
                point(RIGHT_ANKLE)
            )

            # ---------------------------------------------
            # Save landmarks + angles to CSV
            # ---------------------------------------------

            row = [frame_number]

            for landmark in landmarks:

                row.extend([
                    landmark.x,
                    landmark.y,
                    landmark.z,
                    landmark.visibility
                ])

            row.extend([
                left_elbow_angle,
                right_elbow_angle,
                left_knee_angle,
                right_knee_angle
            ])

            csv_writer.writerow(row)

            # ---------------------------------------------
            # Draw pose landmarks
            # ---------------------------------------------

            for landmark in landmarks:

                x = int(
                    landmark.x * width
                )

                y = int(
                    landmark.y * height
                )

                if (
                    0 <= x < width
                    and 0 <= y < height
                ):

                    cv2.circle(
                        frame,
                        (x, y),
                        4,
                        (0, 255, 0),
                        -1
                    )

            # ---------------------------------------------
            # Display angles
            # ---------------------------------------------

            cv2.putText(
                frame,
                f"L Elbow: {left_elbow_angle:.1f}",
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"R Elbow: {right_elbow_angle:.1f}",
                (30, 70),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"L Knee: {left_knee_angle:.1f}",
                (30, 100),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"R Knee: {right_knee_angle:.1f}",
                (30, 130),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

        # -------------------------------------------------
        # Write output frame
        # -------------------------------------------------

        writer.write(frame)

        frame_number += 1

        if frame_number % 100 == 0:

            print(
                f"Processed {frame_number} frames..."
            )

    print(
        f"Processed a total of "
        f"{frame_number} frames."
    )

# ---------------------------------------------------------
# Main Function
# ---------------------------------------------------------

def main():

    # -----------------------------------------------------
    # 1. Check that the pose model exists
    # -----------------------------------------------------

    if not os.path.exists(MODEL_PATH):

        print(
            f"Could not find pose model: "
            f"{MODEL_PATH}"
        )

        return

    # -----------------------------------------------------
    # 2. Check that the input video exists
    # -----------------------------------------------------

    if not os.path.exists(INPUT_VIDEO):

        print(
            f"Could not find input video: "
            f"{INPUT_VIDEO}"
        )

        print(
            "Put a video there when you're ready."
        )

        return

    # -----------------------------------------------------
    # 3. Open the video
    # -----------------------------------------------------

    cap = cv2.VideoCapture(INPUT_VIDEO)

    if not cap.isOpened():

        print(
            f"Could not open video: "
            f"{INPUT_VIDEO}"
        )

        return

    # -----------------------------------------------------
    # 4. Read video properties
    # -----------------------------------------------------

    width = int(
        cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    )

    height = int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps <= 0:

        fps = 30

    print("Video opened successfully!")

    print(
        f"Resolution: "
        f"{width} x {height}"
    )

    print(f"FPS: {fps}")

    # -----------------------------------------------------
    # 5. Create output directory and video writer
    # -----------------------------------------------------

    os.makedirs(
        "data",
        exist_ok=True
    )

    fourcc = cv2.VideoWriter_fourcc(
        *"mp4v"
    )

    writer = cv2.VideoWriter(
        OUTPUT_VIDEO,
        fourcc,
        fps,
        (width, height)
    )

    # -----------------------------------------------------
    # 6. Create CSV file
    # -----------------------------------------------------

    csv_file = open(
        OUTPUT_CSV,
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
    # -----------------------------------------------------
    # 7. Create the pose landmarker
    # -----------------------------------------------------

    landmarker = create_pose_landmarker()

    print(
        "Pose Landmarker loaded successfully!"
    )

    print("Processing video...")

    # -----------------------------------------------------
    # 8. Process the video
    # -----------------------------------------------------

    process_video(
        cap,
        writer,
        csv_writer,
        landmarker,
        width,
        height,
        fps
    )

    # -----------------------------------------------------
    # 9. Clean up
    # -----------------------------------------------------

    landmarker.close()

    cap.release()

    writer.release()

    csv_file.close()

    # -----------------------------------------------------
    # 10. Finished
    # -----------------------------------------------------

    print("\nFinished!")

    print(
        f"Annotated video: "
        f"{OUTPUT_VIDEO}"
    )

    print(
        f"Pose data: "
        f"{OUTPUT_CSV}"
    )


# ---------------------------------------------------------
# Start Program
# ---------------------------------------------------------

if __name__ == "__main__":

    main()
