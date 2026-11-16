import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { updateUserFields } from "@/hooks/useUserQuery";
import { useTheme } from "@/utils/theme";
import { AVATAR_SIZE, normaliseAvatar } from "@/utils/avatar";
import { parseGrid, serializeGrid } from "@/utils/pixelArt";
import { reportError } from "@/utils/reportError";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";

import { Cell, Cells, cellFromPoint, paintLine } from "./avatarGrid";
import "./AvatarEditorModal.scss";

type Tool = "pen" | "eraser";

/** On-screen size of the drawing canvas, in CSS pixels (10px per cell). */
const CANVAS_PX = AVATAR_SIZE * 10;

/** Paint the grid onto the canvas in the current theme's inks. */
const drawCells = (canvas: HTMLCanvasElement, cells: Cells) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const style = getComputedStyle(canvas);
  const ink = style.getPropertyValue("--ink").trim() || "#242424";
  const sheet = style.getPropertyValue("--sheet").trim() || "#ffffff";
  const ghost = style.getPropertyValue("--ink-ghost").trim() || "rgba(36,36,36,0.15)";

  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(CANVAS_PX * dpr);
  if (canvas.width !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  const cell = px / AVATAR_SIZE;

  ctx.fillStyle = sheet;
  ctx.fillRect(0, 0, px, px);

  ctx.fillStyle = ink;
  cells.forEach((row, y) =>
    row.forEach((inked, x) => {
      if (inked)
        ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    }),
  );

  ctx.strokeStyle = ghost;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < AVATAR_SIZE; i++) {
    const at = Math.round(i * cell) + 0.5;
    ctx.moveTo(at, 0);
    ctx.lineTo(at, px);
    ctx.moveTo(0, at);
    ctx.lineTo(px, at);
  }
  ctx.stroke();
};

type AvatarEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Draw your own 30×30 one-ink avatar: pen and eraser on a pixel grid, with a live
 * preview at the sizes it's shown in the app. Render it only while open so it starts
 * from the saved avatar each time.
 */
export const AvatarEditorModal = ({ isOpen, onClose }: AvatarEditorModalProps) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const theme = useTheme();

  const saved = useMemo(() => normaliseAvatar(user?.avatar), [user?.avatar]);
  const [cells, setCells] = useState<Cells>(() => parseGrid(saved, AVATAR_SIZE));
  const [tool, setTool] = useState<Tool>("pen");
  const [pending, setPending] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCell = useRef<Cell | null>(null);
  const drawing = useRef(false);

  const grid = useMemo(() => serializeGrid(cells), [cells]);
  const next = normaliseAvatar(grid);
  const changed = JSON.stringify(next) !== JSON.stringify(saved);

  useEffect(() => {
    if (canvasRef.current) drawCells(canvasRef.current, cells);
  }, [cells, theme]);

  const paintAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const cell = cellFromPoint(e.clientX, e.clientY, box, AVATAR_SIZE);
    if (!cell) return;
    const from = lastCell.current;
    lastCell.current = cell;
    setCells((current) => paintLine(current, from, cell, tool === "pen"));
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pending || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastCell.current = null;
    paintAt(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) paintAt(e);
  };

  const stopDrawing = () => {
    drawing.current = false;
    lastCell.current = null;
  };

  const save = async () => {
    if (!user?.id || pending) return;
    setPending(true);
    try {
      await updateUserFields(user.id, { avatar: next });
      showToast(next ? "Avatar saved" : "Avatar removed", "success");
      onClose();
    } catch (err) {
      reportError(err, { feature: "profile", action: "save_avatar" });
      showToast("Failed to save your avatar. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? undefined : onClose}
      disabled={pending}
      className="AvatarEditor"
    >
      <Modal.Header title="Draw your avatar" striped />
      <Modal.Body className="AvatarEditor__body">
        <div className="AvatarEditor__tools" role="group" aria-label="Drawing tool">
          {(["pen", "eraser"] as const).map((t) => (
            <RowButton
              key={t}
              aria-pressed={tool === t}
              className={cx("AvatarEditor__tool", { "AvatarEditor__tool--active": tool === t })}
              onClick={() => setTool(t)}
            >
              {t}
            </RowButton>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          className={cx("AvatarEditor__canvas", `AvatarEditor__canvas--${tool}`)}
          role="img"
          aria-label="Avatar drawing grid, 30 by 30 pixels"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onLostPointerCapture={stopDrawing}
        />

        <div className="AvatarEditor__preview" aria-label="Preview">
          <Avatar avatar={grid} name={user?.displayName} size={30} />
          <Avatar avatar={grid} name={user?.displayName} size={60} />
          <span className="AvatarEditor__hint">
            {next ? "how it looks around the app" : "a blank avatar shows your initial"}
          </span>
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton />
        <Button
          text="Save avatar"
          buttonStyle="primary-border"
          disabled={!changed}
          loading={pending}
          onClick={() => void save()}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default AvatarEditorModal;
