import { DragEvent } from "react";
import { has, throttle } from "lodash-es";
import { useFrame } from "../../../frame";

import { useAtom } from "jotai";
import { draggedBlockIdAtom, draggingFlagAtom } from "../../../atoms/ui.ts";
import { useAddBlock, useHighlightBlockId, useSelectedBlockIds } from "../../../hooks";
import { useBlocksStoreUndoableActions } from "../../../history/useBlocksStoreUndoableActions.ts";
import { getOrientation } from "./getOrientation.ts";
import { draggedBlockAtom, dropTargetAtom } from "./atoms.ts";

let iframeDocument: null | HTMLDocument = null;
let possiblePositions: [number, number, number][] = [];
let dropTarget: HTMLElement | null = null;
let dropIndex: number | null = null;

const positionPlaceholder = (target: HTMLElement, orientation: "vertical" | "horizontal", mousePosition: number) => {
  if (!iframeDocument || !target) return;
  const placeholder = iframeDocument?.getElementById("placeholder") as HTMLElement;

  const positions = possiblePositions.map(([position]) => {
    return position;
  });

  const closest = positions.reduce(
    (prev, curr) => (Math.abs(curr - mousePosition) < Math.abs(prev - mousePosition) ? curr : prev),
    0,
  );

  const closestIndex = positions.indexOf(closest);

  if (!possiblePositions[closestIndex]) return;
  const values = possiblePositions[closestIndex];

  placeholder.style.width = orientation === "vertical" ? values[2] + "px" : "2px";
  placeholder.style.height = orientation === "vertical" ? "2px" : values[2] + "px";
  placeholder.style.display = "block";
  if (orientation === "vertical") {
    placeholder.style.top = values[0] + "px";
    placeholder.style.left = values[1] + "px";
  } else {
    placeholder.style.top = values[1] + "px";
    placeholder.style.left = values[0] + "px";
  }
};

function calculateDropIndex(mousePosition: number, positions: [number, number, number][]) {
  let closestIndex = 0;
  let closestDistance = Infinity;
  positions.forEach((position, index) => {
    const distance = Math.abs(position[0] - mousePosition);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

const calculatePossiblePositions = (target: HTMLElement) => {
  const orientation = getOrientation(target);
  const isHorizontal = orientation === "horizontal";

  possiblePositions = [];

  Array.from(target.children).forEach((child: HTMLElement, index) => {
    // Skip elements with class 'pointer-events-none'
    if (child.classList.contains("pointer-events-none")) return;

    const position = isHorizontal ? child.offsetLeft : child.offsetTop;
    const size = isHorizontal ? [child.offsetTop, child.clientHeight] : [child.offsetLeft, child.clientWidth];
    possiblePositions.push([position, size[0], size[1]]);

    // Handle last child
    if (index === target.children.length - 1) {
      const lastPosition = isHorizontal ? child.offsetLeft + child.clientWidth : child.offsetTop + child.clientHeight;
      possiblePositions.push([lastPosition, size[0], size[1]]);
    }
  });
};

const throttledDragOver = throttle((e: DragEvent) => {
  const target = e.target as HTMLElement;
  const orientation = getOrientation(target);

  const IframeScrollTop = iframeDocument?.defaultView?.pageYOffset;

  if (orientation === "vertical") {
    positionPlaceholder(target, orientation, e.clientY + IframeScrollTop);
  } else {
    positionPlaceholder(target, orientation, e.clientX);
  }
}, 0);

function removePlaceholder() {
  const placeholder = iframeDocument?.getElementById("placeholder") as HTMLElement;
  placeholder.style.display = "none";
  removeClassFromElements("pointer-none");
  removeDataDrop();
}

function removeClassFromElements(className: string): void {
  const elements = iframeDocument?.querySelectorAll(`.${className}`);
  elements.forEach((element) => {
    element.classList.remove(className);
  });
}

function removeDataDrop(): void {
  const element = iframeDocument?.querySelector('[data-drop="yes"]');
  if (element) {
    element.removeAttribute("data-drop");
  }
}

export const useDnd = () => {
  const { document } = useFrame();
  const [isDragging, setIsDragging] = useAtom(draggingFlagAtom);
  const { addCoreBlock } = useAddBlock();
  const [, setHighlight] = useHighlightBlockId();
  const [, setBlockIds] = useSelectedBlockIds();
  const { moveBlocks } = useBlocksStoreUndoableActions();
  const [, setDraggedBlockId] = useAtom(draggedBlockIdAtom);
  const [draggedBlock, setDraggedBlock] = useAtom(draggedBlockAtom);
  const [, setDropTarget] = useAtom(dropTargetAtom);

  iframeDocument = document as HTMLDocument;
  return {
    isDragging,
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      throttledDragOver(e);
    },
    onDrop: (ev: DragEvent) => {
      dropTarget?.classList.remove("drop-target");
      const block = dropTarget as HTMLElement;
      const orientation = getOrientation(block);
      const mousePosition = orientation === "vertical" ? ev.clientY : ev.clientX;
      dropIndex = calculateDropIndex(mousePosition, possiblePositions);
      const data = draggedBlock;
      const id = block.getAttribute("data-block-id");

      //This is for moving blocks from the sidebar panel
      if (!has(data, "_id")) {
        addCoreBlock(data, id === "canvas" ? null : id, dropIndex);
        setTimeout(() => {
          removePlaceholder();
        }, 300);
        possiblePositions = [];
        setIsDragging(false);
        setDraggedBlockId("");
        //@ts-ignore
        setDraggedBlock(null);
        //@ts-ignore
        setDropTarget(null);
        return;
      }

      // get the block id from the attribute data-block-id from target
      let blockId = block.getAttribute("data-block-id");

      if (blockId === null) {
        const parent = (ev.target as HTMLElement).parentElement;
        blockId = parent.getAttribute("data-block-id");
      }

      //@ts-ignore
      moveBlocks([data._id], blockId, dropIndex);
      removePlaceholder();
      setIsDragging(false);
      setDraggedBlockId("");
      possiblePositions = [];
      setTimeout(() => removePlaceholder(), 300);
    },
    onDragEnter: (e: DragEvent) => {
      const event = e;
      const target = event.target as HTMLElement;
      dropTarget = target;
      const dropTargetId = target.getAttribute("data-block-id");
      //@ts-ignore
      setDropTarget(dropTargetId);
      event.stopPropagation();
      event.preventDefault();
      possiblePositions = [];
      calculatePossiblePositions(target);
      console.log(possiblePositions, e.clientX, e.clientY);
      target.classList.add("drop-target");
      setIsDragging(true);
      setHighlight("");
      setBlockIds([]);
    },
    // onDragLeave: (e: DragEvent) => {
    //   const event = e;
    //   event.stopPropagation();
    //   event.preventDefault();
    //   const target = event.target as HTMLElement;
    //   if (target && target.classList.contains("drop-target")) {
    //     target.classList.remove("drop-target");
    //     if (dropTarget === target) {
    //       dropTarget = null;
    //     }
    //   }
    //   removePlaceholder();
    // },
  };
};
