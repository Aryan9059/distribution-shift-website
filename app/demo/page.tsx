import SingleImageDemo from "@/components/SingleImageDemo";
import { PageTitle, Section } from "@/components/ui";

export default function DemoPage() {
  return (
    <>
      <PageTitle
        title="Demonstration"
        lead="Upload or select a traffic sign sample, apply a distribution shift condition, and see how the classifier responds."
      />
      <Section title="Single-image testing">
        <SingleImageDemo />
      </Section>
    </>
  );
}
