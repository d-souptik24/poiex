"use client"

import { Button } from "@/components/ui/button"
import { StarIcon, StarOffIcon } from "lucide-react"
import type React from "react"
import { useState, useEffect, forwardRef } from "react"
import { toast } from "sonner"
import { toggleStarMarked } from "../actions"
import { useRouter } from "next/navigation"

interface MarkedToggleButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
    markedForRevision: boolean
    id: string
}

export const MarkedToggleButton = forwardRef<HTMLButtonElement, MarkedToggleButtonProps>(
    ({ markedForRevision, id, onClick, className, children, ...props }, ref) => {
        const router = useRouter()
        const [isMarked, setIsMarked] = useState(markedForRevision)

        useEffect(() => {
            setIsMarked(markedForRevision)
        }, [markedForRevision])

        const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
            onClick?.(event as unknown as Parameters<NonNullable<typeof onClick>>[0])

            const newMarkedState = !isMarked
            setIsMarked(newMarkedState)

            // Instant optimistic update across sidebar & dashboard
            window.dispatchEvent(
                new CustomEvent("poiex:star-toggle", {
                    detail: { id, isMarked: newMarkedState },
                })
            )

            try {
                const res = await toggleStarMarked(id, newMarkedState)
                const { success, error, isMarked: serverMarked } = res

                if (serverMarked && !error && success) {
                    toast.success("Added to Favorites successfully")
                } else {
                    toast.success("Removed from Favorites successfully")
                }

                router.refresh()
            } catch (error) {
                console.error("Failed to toggle favorite:", error)
                setIsMarked(!newMarkedState)
                window.dispatchEvent(
                    new CustomEvent("poiex:star-toggle", {
                        detail: { id, isMarked: !newMarkedState },
                    })
                )
                toast.error("Failed to update favorite")
            }
        }

        return (
            <Button
                ref={ref}
                variant="ghost"
                className={`flex items-center justify-start w-full px-2 py-1.5 text-sm rounded-md cursor-pointer ${className}`}
                onClick={handleToggle}
                {...props}
            >
                {isMarked ? (
                    <StarIcon size={16} className="text-amber-500 fill-amber-500 mr-2" />
                ) : (
                    <StarOffIcon size={16} className="text-zinc-400 mr-2" />
                )}
                {children || (isMarked ? "Remove Favorite" : "Add to Favorite")}
            </Button>
        )
    },
)

MarkedToggleButton.displayName = "MarkedToggleButton"
