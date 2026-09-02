/* ==========================================================================
   EKLAVYA — mock-data.js
   Dummy analysis data used in Demo Mode. Kept entirely separate from UI
   code so it can be swapped for a real API response later.
   ========================================================================== */

const EklavyaMock = (() => {

  /** Processing stage list shown on processing.html while "analyzing". */
  const PROCESSING_STAGES = [
    'Uploading video',
    'Extracting frames',
    'Detecting body pose',
    'Tracking movement',
    'Calculating joint angles',
    'Detecting shot',
    'Evaluating technique',
    'Generating feedback'
  ];

  /** Base template for a full analysis result. */
  function buildMockAnalysis({ sport = 'badminton', selectedActivity = 'auto' } = {}) {
    return {
      id: 'analysis_' + Math.random().toString(36).slice(2, 9),
      sport,
      selectedActivity,
      detectedActivity: 'Smash',
      confidence: 0.94,
      techniqueScore: 86,
      tier: 'ADVANCED',

      metrics: {
        armPosition: 88,
        elbowExtension: 91,
        bodyRotation: 82,
        kneePosition: 79,
        balance: 86,
        timing: 90
      },

      metricLabels: {
        armPosition: 'Arm Position',
        elbowExtension: 'Elbow Extension',
        bodyRotation: 'Body Rotation',
        kneePosition: 'Knee Position',
        balance: 'Balance',
        timing: 'Timing'
      },

      feedback: {
        strengths: [
          'Strong elbow extension during contact',
          'Good overhead preparation',
          'Consistent body alignment'
        ],
        improvements: [
          'Increase lower-body contribution',
          'Maintain better balance during follow-through',
          'Start rotation slightly earlier'
        ]
      },

      shots: [
        { type: 'Smash', timestamp: 2.67, confidence: 0.94, score: 88 },
        { type: 'Drop', timestamp: 5.12, confidence: 0.89, score: 81 },
        { type: 'Drive', timestamp: 8.44, confidence: 0.92, score: 85 }
      ],

      movementProfile: {
        explosiveness: 'HIGH',
        mobility: 'GOOD',
        balance: 'GOOD',
        consistency: 'VERY GOOD'
      },

      hasAnnotatedVideo: false,

      frameCount: 412,
      landmarkCount: 33,
      jointAngleCount: 4,

      isDemo: true,
      generatedAt: new Date().toISOString()
    };
  }

  return {
    PROCESSING_STAGES,
    buildMockAnalysis
  };
})();
