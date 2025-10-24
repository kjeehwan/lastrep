import LegalLayout from "./LegalLayout";

export default function TermsOfServiceScreen() {
  return (
    <LegalLayout
      title="Terms of Service"
      sections={[
        {
          content:
            "Welcome to LastRep! By using our app, you agree to these Terms of Service. Please read them carefully before continuing.",
        },
        {
          title: "1. Use of the App",
          content:
            "LastRep is designed to help you track your workouts, nutrition, and recovery. You agree to use it responsibly and in accordance with applicable laws.",
        },
        {
          title: "2. Accounts and Security",
          content:
            "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
        },
        {
          title: "3. Health Disclaimer",
          content:
            "LastRep is not a substitute for professional medical advice. Always consult a qualified healthcare provider before starting any exercise or nutrition plan.",
        },
        {
          title: "4. Termination",
          content:
            "We reserve the right to suspend or terminate your access to LastRep at any time for behavior that violates these Terms or harms other users.",
        },
        {
          title: "5. Changes to These Terms",
          content:
            "We may update these Terms occasionally. Continued use of the app indicates acceptance of the updated version.",
        },
        {
          title: "6. Contact Us",
          content:
            "For any questions about these terms, contact us at support@lastrep.app.",
        },
      ]}
    />
  );
}
