import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, RotateCw, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMember, updateMember, useGym } from "@/lib/gym/store";
import type { Member } from "@/lib/gym/types";
import { isWalkIn } from "@/lib/gym/selectors";

type FormState = {
  name: string;
  email: string;
  phone: string;
  gender: Member["gender"];
  dob: string;
  address: string;
  emergencyContact: string;
  photo: string | null;
  planId: string;
  joiningFee: string;
  discountType: "none" | "percent" | "fixed";
  discountValue: string;
  paidNow: string;
};

const empty: FormState = {
  name: "",
  email: "",
  phone: "",
  gender: "male",
  dob: "",
  address: "",
  emergencyContact: "",
  photo: null,
  planId: "",
  joiningFee: "1000",
  discountType: "none",
  discountValue: "",
  paidNow: "",
};

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member?: Member | null;
}) {
  const state = useGym();
  const [form, setForm] = useState<FormState>(empty);
  const [step, setStep] = useState<1 | 2>(1);
  const [membershipStepReady, setMembershipStepReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropImageSize, setCropImageSize] = useState({ width: 1, height: 1 });
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropViewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const initializedForRef = useRef<string | null>(null);
  const stepTransitionRef = useRef(false);
  const stepReadyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      initializedForRef.current = null;
      return;
    }
    const initializationKey = member?.id ?? "new-member";
    if (initializedForRef.current === initializationKey) return;
    initializedForRef.current = initializationKey;
    setErrors({});
    setStep(1);
    setMembershipStepReady(false);
    const firstPlan = state?.plans.find((p) => !p.deletedAt);
    setForm(
      member
        ? {
            name: member.name,
            email: member.email,
            phone: member.phone,
            gender: member.gender,
            dob: member.dob ? member.dob.slice(0, 10) : "",
            address: member.address,
            emergencyContact: member.emergencyContact,
            photo: member.photo ?? null,
            planId: "",
            joiningFee: "",
            discountType: "none",
            discountValue: "",
            paidNow: "",
          }
        : {
            ...empty,
            planId: firstPlan?.id ?? "",
            joiningFee: String(firstPlan?.joiningFee ?? 1000),
          },
    );
  }, [open, member, state]);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;

    const startCamera = async () => {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is unavailable in this browser. Try Upload photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(
          "Camera permission was denied or the camera is unavailable. Allow access and try again.",
        );
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!open) {
      setCameraOpen(false);
      setCropSource(null);
      if (stepReadyTimerRef.current !== null) {
        window.clearTimeout(stepReadyTimerRef.current);
        stepReadyTimerRef.current = null;
      }
    }
  }, [open]);

  if (!state) return null;
  const editingWalkIn = Boolean(member && isWalkIn(member));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedPlan = state.plans.find((p) => p.id === form.planId && !p.deletedAt) ?? null;
  const originalPrice = selectedPlan?.price ?? 0;
  const rawDiscount =
    form.discountType === "none"
      ? 0
      : form.discountType === "percent"
        ? (originalPrice * (Number(form.discountValue) || 0)) / 100
        : Number(form.discountValue) || 0;
  const discountAmount = Math.min(Math.max(0, Math.round(rawDiscount)), originalPrice);
  const joiningFeeNum = Number(form.joiningFee);
  const joiningFee = Number.isFinite(joiningFeeNum) ? Math.max(0, Math.round(joiningFeeNum)) : 0;
  const finalPrice = originalPrice - discountAmount + joiningFee;
  const paidNowNum = Number(form.paidNow || 0);
  const remainingBalance = Math.max(0, finalPrice - (Number.isFinite(paidNowNum) ? paidNowNum : 0));
  const cur = state.settings.currency;

  // Live (auto-updating) validation for discount + amount paid.
  let liveDiscountError = "";
  if (!member && form.discountType !== "none") {
    const dv = Number(form.discountValue);
    if (form.discountValue === "" || Number.isNaN(dv) || !Number.isFinite(dv) || dv < 0)
      liveDiscountError = "Enter a valid discount.";
    else if (form.discountType === "percent" && dv > 100)
      liveDiscountError = "Discount cannot exceed 100%.";
    else if (form.discountType === "fixed" && dv > originalPrice)
      liveDiscountError = "Discount cannot exceed the membership price.";
  }
  let livePaidError = "";
  if (!member && form.paidNow !== "") {
    const paid = Number(form.paidNow);
    if (Number.isNaN(paid) || !Number.isFinite(paid)) livePaidError = "Enter a valid amount.";
    else if (paid < 0) livePaidError = "Amount cannot be negative.";
    else if (form.planId && paid > finalPrice)
      livePaidError = "Amount paid cannot exceed the final payable amount.";
  }

  let liveJoiningFeeError = "";
  if (!member) {
    if (form.joiningFee === "" || !Number.isFinite(Number(form.joiningFee)))
      liveJoiningFeeError = "Enter a valid joining fee.";
    else if (Number(form.joiningFee) < 0) liveJoiningFeeError = "Joining fee cannot be negative.";
  }

  const personalErrors = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (form.name.trim().length > 80) e.name = "Name is too long.";
    if ((!editingWalkIn || form.email.trim()) && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      e.email = "Enter a valid email address.";
    if (form.phone.trim().replace(/\D/g, "").length < 8) e.phone = "Enter a valid phone number.";
    if (!editingWalkIn && !form.dob) e.dob = "Date of birth is required.";
    else if (new Date(form.dob) > new Date()) e.dob = "Date of birth cannot be in the future.";
    if (form.address.trim().length > 200) e.address = "Address is too long.";
    return e;
  };

  const validatePersonal = () => {
    const e = personalErrors();
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const advanceToMembership = () => {
    if (!validatePersonal()) return;
    stepTransitionRef.current = true;
    setMembershipStepReady(false);
    setStep(2);
    window.setTimeout(() => {
      stepTransitionRef.current = false;
    }, 250);
    if (stepReadyTimerRef.current !== null) window.clearTimeout(stepReadyTimerRef.current);
    stepReadyTimerRef.current = window.setTimeout(() => {
      setMembershipStepReady(true);
      stepReadyTimerRef.current = null;
    }, 600);
  };

  const validate = () => {
    const e = personalErrors();
    if (!member && !form.planId) e.planId = "Select a membership plan.";
    if (liveJoiningFeeError) e.joiningFee = liveJoiningFeeError;
    if (liveDiscountError) e.discount = liveDiscountError;
    if (livePaidError) e.paidNow = livePaidError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => openCrop(String(reader.result));
    reader.readAsDataURL(file);
  };

  const openCrop = (source: string) => {
    setCropZoom(1);
    setCropPosition({ x: 0, y: 0 });
    setCropSource(source);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      toast.error("Camera is still starting. Please try again in a moment.");
      return;
    }
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast.error("Photo could not be captured. Please try again.");
        if (blob.size > 2 * 1024 * 1024) {
          return toast.error("Captured image must be smaller than 2MB");
        }
        const reader = new FileReader();
        reader.onload = () => {
          setCameraOpen(false);
          openCrop(String(reader.result));
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.82,
    );
  };

  const cropMetrics = () => {
    const viewport = cropViewportRef.current?.clientWidth ?? 320;
    const ratio = cropImageSize.width / cropImageSize.height;
    const baseWidth = ratio >= 1 ? viewport * ratio : viewport;
    const baseHeight = ratio >= 1 ? viewport : viewport / ratio;
    const width = baseWidth * cropZoom;
    const height = baseHeight * cropZoom;
    return {
      viewport,
      width,
      height,
      maxX: Math.max(0, (width - viewport) / 2),
      maxY: Math.max(0, (height - viewport) / 2),
    };
  };

  const clampCropPosition = (x: number, y: number) => {
    const { maxX, maxY } = cropMetrics();
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const useCroppedPhoto = () => {
    if (!cropSource) return;
    const image = new Image();
    image.onload = () => {
      const { viewport, width } = cropMetrics();
      const renderScale = width / image.naturalWidth;
      const sourceSize = viewport / renderScale;
      const centerX = image.naturalWidth / 2 - cropPosition.x / renderScale;
      const centerY = image.naturalHeight / 2 - cropPosition.y / renderScale;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      canvas
        .getContext("2d")
        ?.drawImage(
          image,
          centerX - sourceSize / 2,
          centerY - sourceSize / 2,
          sourceSize,
          sourceSize,
          0,
          0,
          640,
          640,
        );
      canvas.toBlob(
        (blob) => {
          if (!blob) return toast.error("Photo could not be cropped. Please try again.");
          if (blob.size > 2 * 1024 * 1024) return toast.error("Cropped photo is too large");
          const reader = new FileReader();
          reader.onload = () => {
            set("photo", String(reader.result));
            setCropSource(null);
            toast.success("Photo cropped and ready");
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.86,
      );
    };
    image.src = cropSource;
  };

  const rotateCropSource = () => {
    if (!cropSource) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalHeight;
      canvas.height = image.naturalWidth;
      const context = canvas.getContext("2d");
      context?.translate(canvas.width / 2, canvas.height / 2);
      context?.rotate(Math.PI / 2);
      context?.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      openCrop(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.src = cropSource;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!member && step === 1) {
      advanceToMembership();
      return;
    }
    if (!member && !membershipStepReady) return;
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      dob: editingWalkIn ? (member?.dob ?? "") : new Date(form.dob).toISOString(),
      address: form.address.trim(),
      emergencyContact: form.emergencyContact.trim(),
      photo: form.photo,
    };
    if (member) {
      updateMember(member.id, payload);
      toast.success(`${payload.name} updated`);
    } else {
      addMember({
        ...payload,
        planId: form.planId || undefined,
        joiningFee,
        discount: form.planId ? discountAmount : 0,
        paidNow: Math.min(Number(form.paidNow || 0), form.planId ? finalPrice : 0),
      });
      toast.success(`${payload.name} added to the roster`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && stepTransitionRef.current) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {editingWalkIn ? "Edit Walk-in Customer" : member ? "Edit Member" : "Add New Member"}
          </DialogTitle>
          <DialogDescription>
            {editingWalkIn
              ? "Update this customer's basic contact information."
              : member
                ? "Update contact details and personal information."
                : step === 1
                  ? "Enter the member's personal and contact details."
                  : "Choose the membership plan and confirm the joining payment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {!member && (
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <div
                className={`rounded-full border px-3 py-2 text-center ${
                  step === 1
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground"
                }`}
              >
                1. Personal details
              </div>
              <div
                className={`rounded-full border px-3 py-2 text-center ${
                  step === 2
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground"
                }`}
              >
                2. Membership details
              </div>
            </div>
          )}

          {(member || step === 1) && (
            <>
              {!editingWalkIn && (
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold/30 bg-secondary text-gold">
                    {form.photo ? (
                      <img src={form.photo} alt="Member" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-xl">
                        {(form.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        onFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" /> Upload photo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCameraOpen(true)}
                      >
                        <Camera className="mr-2 h-4 w-4" /> Capture photo
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Stored locally, max 2MB.</p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={80}
                  />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    maxLength={20}
                  />
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={120}
                  />
                </Field>
                {!editingWalkIn && (
                  <Field label="Date of birth" error={errors.dob}>
                    <Input
                      type="date"
                      value={form.dob}
                      onChange={(e) => set("dob", e.target.value)}
                    />
                  </Field>
                )}
                {!editingWalkIn && (
                  <Field label="Gender">
                    <Select
                      value={form.gender}
                      onValueChange={(v) => set("gender", v as Member["gender"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {!editingWalkIn && (
                  <Field label="Emergency contact">
                    <Input
                      value={form.emergencyContact}
                      onChange={(e) => set("emergencyContact", e.target.value)}
                      maxLength={20}
                    />
                  </Field>
                )}
              </div>

              <Field label="Address" error={errors.address}>
                <Textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  maxLength={200}
                />
              </Field>
            </>
          )}

          {!member && step === 2 && (
            <div className="grid gap-4 rounded-xl border border-gold/25 bg-secondary/30 p-4 sm:grid-cols-2">
              <Field label="Membership plan" error={errors.planId}>
                <Select
                  value={form.planId}
                  onValueChange={(v) => {
                    const plan = state.plans.find((item) => item.id === v);
                    setForm((current) => ({
                      ...current,
                      planId: v,
                      joiningFee: String(plan?.joiningFee ?? 1000),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.plans
                      .filter((p) => !p.deletedAt)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {state.settings.currency}
                          {p.price.toLocaleString("en-IN")}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={`Joining fee (${cur})`}
                error={liveJoiningFeeError || errors.joiningFee}
              >
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={form.joiningFee}
                  onChange={(e) => set("joiningFee", e.target.value)}
                />
              </Field>
              <Field label="Discount type">
                <Select
                  value={form.discountType}
                  onValueChange={(v) => set("discountType", v as FormState["discountType"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount ({cur})</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.discountType !== "none" && (
                <Field
                  label={form.discountType === "percent" ? "Discount (%)" : `Discount (${cur})`}
                  error={liveDiscountError || errors.discount}
                >
                  <Input
                    type="number"
                    min={0}
                    max={form.discountType === "percent" ? 100 : originalPrice}
                    value={form.discountValue}
                    onChange={(e) => set("discountValue", e.target.value)}
                    placeholder="0"
                  />
                </Field>
              )}
              {form.planId && (
                <div className="space-y-1 rounded-lg border border-border bg-background/40 p-3 text-sm sm:col-span-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Original price</span>
                    <span className="text-foreground">
                      {cur}
                      {originalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="text-foreground">
                      - {cur}
                      {discountAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Joining fee</span>
                    <span className="text-foreground">
                      + {cur}
                      {joiningFee.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Final payable</span>
                    <span className="text-gold">
                      {cur}
                      {finalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Remaining balance</span>
                    <span className="text-foreground">
                      {cur}
                      {remainingBalance.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
              <Field label="Amount paid now" error={livePaidError || errors.paidNow}>
                <Input
                  type="number"
                  min={0}
                  max={finalPrice}
                  step="1"
                  value={form.paidNow}
                  onChange={(e) => set("paidNow", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!member && step === 2 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMembershipStepReady(false);
                  setStep(1);
                }}
              >
                Back
              </Button>
            )}
            {!member && step === 1 ? (
              <Button type="button" onClick={advanceToMembership}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={!member && !membershipStepReady}>
                {member ? "Save changes" : "Add member"}
              </Button>
            )}
          </div>
        </form>

        <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl tracking-wide">
                Capture member photo
              </DialogTitle>
              <DialogDescription>
                Position the member in the frame, then capture the photo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-black">
                {cameraError ? (
                  <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
                    {cameraError}
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-full w-full scale-x-[-1] object-cover"
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCameraOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" /> Capture photo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(cropSource)} onOpenChange={(next) => !next && setCropSource(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl tracking-wide">Crop photo</DialogTitle>
              <DialogDescription>
                Drag to reposition the image inside the square. Use zoom or rotate if needed.
              </DialogDescription>
            </DialogHeader>
            {cropSource && (
              <div className="space-y-5">
                <div
                  ref={cropViewportRef}
                  className="relative mx-auto aspect-square w-[min(78vw,360px)] touch-none cursor-move overflow-hidden rounded-2xl border border-gold/40 bg-black select-none"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      startX: cropPosition.x,
                      startY: cropPosition.y,
                    };
                  }}
                  onPointerMove={(event) => {
                    if (!dragRef.current) return;
                    setCropPosition(
                      clampCropPosition(
                        dragRef.current.startX + event.clientX - dragRef.current.x,
                        dragRef.current.startY + event.clientY - dragRef.current.y,
                      ),
                    );
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                  }}
                >
                  <img
                    src={cropSource}
                    alt="Crop preview"
                    draggable={false}
                    onLoad={(event) =>
                      setCropImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                    }
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
                    style={{
                      width: cropMetrics().width,
                      height: cropMetrics().height,
                      marginLeft: cropPosition.x,
                      marginTop: cropPosition.y,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 border-[3px] border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
                  <div className="pointer-events-none absolute inset-1/3 border border-white/35" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Label>Zoom</Label>
                    <span>{Math.round(cropZoom * 100)}%</span>
                  </div>
                  <Slider
                    min={1}
                    max={3}
                    step={0.05}
                    value={[cropZoom]}
                    onValueChange={([next]) => {
                      setCropZoom(next);
                      setCropPosition({ x: 0, y: 0 });
                    }}
                    aria-label="Photo zoom"
                  />
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  <Button type="button" variant="secondary" onClick={rotateCropSource}>
                    <RotateCw className="mr-2 h-4 w-4" /> Rotate
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setCropSource(null)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={useCroppedPhoto}>
                      Use photo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
