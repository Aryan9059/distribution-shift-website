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
        <p className="text-xs text-muted">
          This demo runs the same ResNet-18 checkpoint the published results use, on one image at a time, so it
          shows how robust the classifier itself is. The Detect–Trust–Adapt detector and adapter work on 64-frame
          windows of a stream; see the Results page for their effect.
        </p>
      </Section>
    </>
  );
}
