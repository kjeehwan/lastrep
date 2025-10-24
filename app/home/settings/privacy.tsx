import LegalLayout from "./LegalLayout";

export default function PrivacyPolicyScreen() {
  return (
    <LegalLayout
      title="Privacy Policy"
      sections={[
        {
          content:
            "At LastRep, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our app.",
        },
        {
          title: "1. Information We Collect",
          content:
            "We may collect your name, email, profile data (like height, weight, and preferences), and anonymized app usage statistics to improve your experience.",
        },
        {
          title: "2. How We Use Your Data",
          content:
            "Your data helps us personalize your workouts, track progress, and provide insights into your training habits. We never sell your personal information to third parties.",
        },
        {
          title: "3. Data Storage & Security",
          content:
            "All personal data is securely stored in Firebase and protected using encryption and access controls. Only authorized systems can read or update your records.",
        },
        {
          title: "4. Your Choices",
          content:
            "You can update your profile, toggle privacy settings, or request account deletion anytime from the Settings screen.",
        },
        {
          title: "5. Contact Us",
          content:
            "For questions or concerns about this policy, contact us at support@lastrep.app.",
        },
      ]}
    />
  );
}
