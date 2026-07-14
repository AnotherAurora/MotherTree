"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildAwakenerOptionMap,
  formatSelectedRealms,
} from "@/components/simulator/awakener-selection";
import { createEmptySlots } from "@/components/simulator/mock-data";
import { BuildStep } from "@/components/path-carver/build-step";
import { LoadDesireModal } from "@/components/path-carver/load-desire-modal";
import { PathCarverHeader } from "@/components/path-carver/path-carver-header";
import {
  buildNewDemandForms,
  buildSaveDemands,
  ReviewDemandsStep,
  useReviewDemandsValid,
  type DemandFormValues,
} from "@/components/path-carver/review-demands-step";
import { ReviewTagsStep } from "@/components/path-carver/review-tags-step";
import {
  getPathCarverDesireBundle,
  savePathCarverDesire,
} from "@/lib/actions/path-carver";
import type { SimulatorGearOptions } from "@/lib/actions/simulator-flow";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import {
  buildCovenantOptionMap,
  buildWheelOptionMap,
} from "@/lib/simulator/gear-selection";
import type {
  AnchoredAwakenerState,
  DraftDemandSelection,
  EditableDemand,
  PathCarverMode,
  WizardStep,
} from "@/lib/path-carver/types";
import {
  validateBuildStep,
  validateDesireName,
  validateReview1Selections,
} from "@/lib/path-carver/validation";
import type { SlotState } from "@/lib/simulator/types";

type PathCarverProps = {
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
};

export function PathCarver({
  awakenerOptions,
  gearOptions,
}: PathCarverProps) {
  const [step, setStep] = useState<WizardStep>("build");
  const [mode, setMode] = useState<PathCarverMode>("create");
  const [desireId, setDesireId] = useState<number | null>(null);
  const [desireName, setDesireName] = useState("");
  const [desireDescription, setDesireDescription] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(() => createEmptySlots());
  const [posseId, setPosseId] = useState<number | null>(null);
  const [anchoredAwakeners, setAnchoredAwakeners] = useState<
    AnchoredAwakenerState[]
  >([]);
  const [newDemandSelections, setNewDemandSelections] = useState<
    DraftDemandSelection[]
  >([]);
  const [existingDemands, setExistingDemands] = useState<EditableDemand[]>([]);
  const [deletedDemandIds, setDeletedDemandIds] = useState<number[]>([]);
  const [newDemandForms, setNewDemandForms] = useState<DemandFormValues[]>([]);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);

  const optionMap = useMemo(
    () => buildAwakenerOptionMap(awakenerOptions),
    [awakenerOptions],
  );

  const covenantMap = useMemo(
    () => buildCovenantOptionMap(gearOptions.covenant),
    [gearOptions.covenant],
  );

  const wheelMap = useMemo(
    () => buildWheelOptionMap(gearOptions.wheel),
    [gearOptions.wheel],
  );

  const realmDisplay = useMemo(
    () => formatSelectedRealms(slots, optionMap),
    [slots, optionMap],
  );

  const buildValid = useMemo(
    () =>
      validateBuildStep(
        slots,
        posseId,
        anchoredAwakeners,
        optionMap,
        covenantMap,
        wheelMap,
      ).valid,
    [slots, posseId, anchoredAwakeners, optionMap, covenantMap, wheelMap],
  );

  const review1Valid = useMemo(() => {
    const nameOk = validateDesireName(desireName).valid;
    const selectionsOk = validateReview1Selections(
      newDemandSelections,
      existingDemands,
      mode,
    ).valid;
    return nameOk && selectionsOk;
  }, [desireName, newDemandSelections, existingDemands, mode]);

  const review2Valid = useReviewDemandsValid(existingDemands, newDemandForms);

  const canAdvance =
    step === "build"
      ? buildValid
      : step === "review1"
        ? review1Valid
        : review2Valid;

  const showDesireName = desireId != null || step !== "build";

  const handleLoadDesire = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setTemplateWarning(null);

    const result = await getPathCarverDesireBundle(id);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const bundle = result.data;
    setMode("edit");
    setDesireId(bundle.desire.id);
    setDesireName(bundle.desire.name);
    setDesireDescription(bundle.desire.description ?? "");
    setAnchoredAwakeners(bundle.anchoredAwakeners);
    setExistingDemands(bundle.demands);
    setNewDemandSelections([]);
    setNewDemandForms([]);
    setDeletedDemandIds([]);
    setStep("build");
    setLoadModalOpen(false);

    if (bundle.template) {
      setSlots(bundle.template.slots);
      setPosseId(bundle.template.posseId);
    } else {
      setSlots(createEmptySlots());
      setPosseId(null);
      setTemplateWarning(
        "This desire has no saved team template. Build a team before saving.",
      );
    }
  }, []);

  function handleNext() {
    setError(null);
    setSuccessMessage(null);

    if (step === "build") {
      setStep("review1");
      return;
    }

    if (step === "review1") {
      setNewDemandForms(buildNewDemandForms(newDemandSelections));
      setStep("review2");
    }
  }

  function handleBack() {
    setError(null);
    if (step === "review1") {
      setStep("build");
      setNewDemandSelections([]);
    } else if (step === "review2") {
      setStep("review1");
      setNewDemandForms([]);
    }
  }

  async function handleSave() {
    if (posseId == null) {
      setError("Posse is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const demands = buildSaveDemands(existingDemands, newDemandForms);

    const result = await savePathCarverDesire({
      desireId: desireId ?? undefined,
      name: desireName.trim(),
      description: desireDescription.trim() || null,
      slots,
      posseId,
      anchoredAwakeners,
      demands,
      deletedDemandIds,
    });

    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMode("edit");
    setDesireId(result.data.desireId);
    setNewDemandSelections([]);
    setNewDemandForms([]);
    setDeletedDemandIds([]);

    const bundleResult = await getPathCarverDesireBundle(result.data.desireId);
    if (bundleResult.success) {
      setExistingDemands(bundleResult.data.demands);
    }

    setStep("build");
    setSuccessMessage(`Saved "${desireName.trim()}" successfully.`);
  }

  function handleDeleteExistingDemand(id: number) {
    setExistingDemands((prev) =>
      prev.map((d) => (d.id === id ? { ...d, markedForDelete: true } : d)),
    );
    setDeletedDemandIds((prev) =>
      prev.includes(id) ? prev : [...prev, id],
    );
  }

  function handleExistingDemandChange(
    id: number,
    updates: Partial<EditableDemand>,
  ) {
    setExistingDemands((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Path Carver
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Author desires with team templates, anchors, and core tag demands.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {templateWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {templateWarning}
        </div>
      )}

      <PathCarverHeader
        step={step}
        realm={realmDisplay}
        posseId={posseId}
        gearOptions={gearOptions}
        desireName={desireName}
        showDesireName={showDesireName}
        onPosseChange={setPosseId}
        onLoad={() => setLoadModalOpen(true)}
        onBack={handleBack}
        onNext={handleNext}
        onSave={handleSave}
        canAdvance={canAdvance}
        saving={saving}
        loading={loading}
      />

      {step === "build" && (
        <BuildStep
          slots={slots}
          posseId={posseId}
          anchoredAwakeners={anchoredAwakeners}
          awakenerOptions={awakenerOptions}
          gearOptions={gearOptions}
          onSlotsChange={setSlots}
          onAnchoredChange={setAnchoredAwakeners}
        />
      )}

      {step === "review1" && (
        <ReviewTagsStep
          slots={slots}
          posseId={posseId}
          desireName={desireName}
          desireDescription={desireDescription}
          mode={mode}
          selections={newDemandSelections}
          existingDemands={existingDemands}
          onDesireNameChange={setDesireName}
          onDesireDescriptionChange={setDesireDescription}
          onSelectionsChange={setNewDemandSelections}
        />
      )}

      {step === "review2" && (
        <ReviewDemandsStep
          mode={mode}
          newSelections={newDemandSelections}
          existingDemands={existingDemands}
          newDemandForms={newDemandForms}
          onNewDemandFormsChange={setNewDemandForms}
          onExistingDemandChange={handleExistingDemandChange}
          onDeleteExistingDemand={handleDeleteExistingDemand}
        />
      )}

      <LoadDesireModal
        open={loadModalOpen}
        onOpenChange={setLoadModalOpen}
        onSelect={handleLoadDesire}
        loading={loading}
      />
    </div>
  );
}
