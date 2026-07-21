const STAGE_QUOTES={
  0:'Every journey starts with a single stroke.',
  1:'You showed up. That is more than most people do.',
  2:'Momentum is building. You are becoming a rower.',
  3:'This is not something you do. This is who you are.'
};

const DONE_PRAISE=[
  'You powered through {blocks} blocks \u2014 that\u2019s {sprints} sprints of pure commitment.',
  '{streak} sessions in a row. You are not just rowing \u2014 you ARE a rower.',
  '{blocks} blocks down. Your cardiovascular system just got measurably stronger.',
  'That\u2019s {sprints} all-out sprints completed. Most people never push this hard.',
  'Session #{total} in the books. Consistency beats intensity every time \u2014 and you have both.',
  '{blocks} blocks of 10-20-30 intervals. Researchers would be proud of this data.',
  'Another session, another step toward second nature. {streak} in a row and counting.',
  '{sprints} sprints. Your VO2max thanks you.',
  '{blocks} blocks completed \u2014 the kind of effort that rewires your physiology.',
  'You just did what most people only think about. {streak}-session streak is real.',
  'The rower is back. {blocks} blocks, {sprints} sprints, zero excuses.',
  '{total} total sessions completed. This is who you are now.'
];
const DONE_TIPS=[
  'Aim for stroke rate 30+ spm during sprints, 18\u201320 during low-intensity.',
  'Active recovery between blocks (light rowing) clears lactate faster than sitting still.',
  'Keep drag factor at 115\u2013125 for interval work \u2014 it\u2019s about speed, not resistance.',
  'Hydrate 500 ml in the 2 hours before your session for optimal performance.',
  'Focus on the catch: arms straight, body forward, shins vertical \u2014 then drive with legs.',
  'Post-session protein within 30 min accelerates muscle recovery (20\u201340 g is ideal).'
];
const DAILY_TIPS=[
  'The 10-20-30 method improved VO2max by 4% and reduced blood pressure in just 8 weeks (Gunnarsson & Bangsbo, 2012).',
  'Stroke rate guide: 16\u201320 spm during low, 22\u201326 during moderate, 30+ during sprints.',
  'Active recovery between blocks helps clear lactate faster than sitting still.',
  'The 30-second sprint intervals are key \u2014 they trigger the highest cardiovascular adaptation.',
  'Drag factor 115\u2013125 is the sweet spot for rowing intervals. Higher isn\u2019t always better.',
  'Trained runners who switched to 10-20-30 improved 1500 m time by 23 seconds and 5K by 48 seconds.',
  'The moderate (20-second) phase builds aerobic base. Stay controlled \u2014 this is your recovery runway.',
  'Heart rate variability improves with consistent interval training \u2014 a sign of better autonomic health.',
  'The 10-second low phase isn\u2019t wasted time \u2014 it teaches pacing and lets phosphocreatine reload.',
  'Blood pressure dropped significantly in both healthy subjects and hypertensive patients using 10-20-30.',
  'Consistency beats intensity: 3 sessions per week is more effective than 5 sporadic ones.',
  'LDL cholesterol decreased by 0.5 mmol/L in subjects training with this protocol for 7 weeks.',
  'Breathing tip: exhale on the drive, inhale on the recovery. Match it to your stroke rhythm.',
  'The warmup primes your cardiovascular system. Skipping it reduces performance and increases injury risk.',
  'Your body adapts between sessions, not during them. Rest days are when you actually get fitter.',
  'At sprint intensity, your muscles produce force 3\u20135x their resting level. That\u2019s real power output.',
  'Pain during sprints is temporary. The VO2max gains are permanent (as long as you keep training).',
  'The original study used running, but rowing adds upper body and core \u2014 more muscle mass, more benefit.',
  'Total training volume with 10-20-30 is ~50% less than traditional training, with equal or better results.',
  'Cool-down helps shift your nervous system from sympathetic to parasympathetic \u2014 important for recovery.'
];
const STAGE_IDENTITY={
  0:{subtitle:'',tagline:''},
  1:{subtitle:'You\u2019re trying something new',tagline:'Every session teaches your body something new'},
  2:{subtitle:'You\u2019re becoming a rower',tagline:'Your body is adapting \u2014 consistency is your superpower'},
  3:{subtitle:'You are a rower',tagline:'Another day, another session \u2014 this is just what you do'}
};
export{DAILY_TIPS,DONE_PRAISE,DONE_TIPS,STAGE_IDENTITY};
