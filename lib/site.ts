// Central brand config. "Gainz" is a working title — change `name` here to rebrand.
export const site = {
  name: "Gainz",
  tagline: "Train smarter. Track everything.",
  description:
    "The all-in-one gym companion: log every workout, learn any machine, and let AI count your calories and map the path to your goal weight.",
  // Marketing bullets, reused for metadata and the hero.
  valueProp:
    "Workout tracking, machine tutorials, and AI-powered nutrition — in one app.",
  launch: "Launching 2026",
  social: {
    twitter: "@gainzapp",
  },
} as const;

export const features = [
  {
    title: "Effortless workout tracking",
    body: "Log sets, reps, and weight in seconds. See your history and watch your strength climb over time.",
    icon: "dumbbell",
  },
  {
    title: "Machine tutorials, in your pocket",
    body: "Never guess how a machine works. Quick-access photos and short how-tos for every station on the floor.",
    icon: "book",
  },
  {
    title: "AI calorie tracker",
    body: "Snap a photo of your meal and get an instant calorie and macro estimate. No more manual searching.",
    icon: "camera",
  },
  {
    title: "AI goal coaching",
    body: "Set your target weight and timeline. AI calculates exactly how many calories to eat to get there.",
    icon: "target",
  },
] as const;

export const steps = [
  {
    n: "01",
    title: "Track your workouts",
    body: "Build sessions and log every lift. Your progress, always with you.",
  },
  {
    n: "02",
    title: "Learn every machine",
    body: "Tap any station for a quick photo tutorial before you sit down.",
  },
  {
    n: "03",
    title: "Reach your goal",
    body: "Snap your meals and let AI keep your calories on target for your goal weight.",
  },
] as const;
