"use client";

import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface ActionTooltipProps {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}

export function ActionTooltip({
  label,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  className,
}: ActionTooltipProps) {
  const childProps = children.props as Record<string, unknown>;
  const stringLabel = typeof label === "string" ? label : undefined;

  let processedChild = children;

  // If child has a render prop (e.g. DropdownMenuTrigger render={<button ... />})
  if (React.isValidElement(childProps.render)) {
    const innerRender = childProps.render as React.ReactElement;
    const innerProps = innerRender.props as Record<string, unknown>;
    const modifiedInner = React.cloneElement(innerRender, {
      title: undefined,
      "aria-label": (innerProps["aria-label"] as string | undefined) || stringLabel,
    } as React.Attributes);
    processedChild = React.cloneElement(children, {
      render: modifiedInner,
      title: undefined,
      "aria-label": (childProps["aria-label"] as string | undefined) || stringLabel,
    } as React.Attributes);
  } else {
    processedChild = React.cloneElement(children, {
      title: undefined,
      "aria-label": (childProps["aria-label"] as string | undefined) || stringLabel,
    } as React.Attributes);
  }

  return (
    <Tooltip>
      <TooltipTrigger render={processedChild} />
      <TooltipContent side={side} align={align} sideOffset={sideOffset} className={className}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
