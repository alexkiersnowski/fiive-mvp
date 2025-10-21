"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

// Move getDefaultClassNames outside to avoid calling on every render
const DEFAULT_CLASSNAMES = getDefaultClassNames()

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  fromYear,
  toYear,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  fromYear?: number
  toYear?: number
}) {
  const [month, setMonth] = React.useState<Date>(props.defaultMonth || new Date())

  // Sync month state with external month prop changes - safer comparison
  React.useEffect(() => {
    if (props.month && props.month.toDateString() !== month.toDateString()) {
      setMonth(props.month)
    }
  }, [props.month, month])

  // Navigation handlers with proper date handling
  const goToPreviousYear = React.useCallback(() => {
    const newMonth = new Date(month)
    newMonth.setFullYear(newMonth.getFullYear() - 1)
    setMonth(newMonth)
  }, [month])

  const goToPreviousMonth = React.useCallback(() => {
    const newMonth = new Date(month)
    newMonth.setMonth(newMonth.getMonth() - 1)
    setMonth(newMonth)
  }, [month])

  const goToNextMonth = React.useCallback(() => {
    const newMonth = new Date(month)
    newMonth.setMonth(newMonth.getMonth() + 1)
    setMonth(newMonth)
  }, [month])

  const goToNextYear = React.useCallback(() => {
    const newMonth = new Date(month)
    newMonth.setFullYear(newMonth.getFullYear() + 1)
    setMonth(newMonth)
  }, [month])

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      month={month}
      onMonthChange={setMonth}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:--spacing(9)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent [&_select]:!h-[32px] [&_span]:!h-[32px]",
        "rtl:[.rdp-button_next>svg]:rotate-180",
        "rtl:[.rdp-button_previous>svg]:rotate-180",
        className
      )}
      captionLayout="label"
      fromYear={fromYear}
      toYear={toYear}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", DEFAULT_CLASSNAMES.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          DEFAULT_CLASSNAMES.months
        ),
        month: cn("flex flex-col w-full gap-4", DEFAULT_CLASSNAMES.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          DEFAULT_CLASSNAMES.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          DEFAULT_CLASSNAMES.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          DEFAULT_CLASSNAMES.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          DEFAULT_CLASSNAMES.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          DEFAULT_CLASSNAMES.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md h-8",
          DEFAULT_CLASSNAMES.dropdown_root
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          DEFAULT_CLASSNAMES.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          DEFAULT_CLASSNAMES.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", DEFAULT_CLASSNAMES.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          DEFAULT_CLASSNAMES.weekday
        ),
        week: cn("flex w-full mt-2", DEFAULT_CLASSNAMES.week),
        week_number_header: cn(
          "select-none w-(--cell-size)",
          DEFAULT_CLASSNAMES.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          DEFAULT_CLASSNAMES.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
          DEFAULT_CLASSNAMES.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          DEFAULT_CLASSNAMES.range_start
        ),
        range_middle: cn("rounded-none", DEFAULT_CLASSNAMES.range_middle),
        range_end: cn("rounded-r-md bg-accent", DEFAULT_CLASSNAMES.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          DEFAULT_CLASSNAMES.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          DEFAULT_CLASSNAMES.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          DEFAULT_CLASSNAMES.disabled
        ),
        hidden: cn("invisible", DEFAULT_CLASSNAMES.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              {...props}
              className={cn(className)}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        Nav: ({ children, ...props }) => {
          // Filter out all react-day-picker specific props that aren't valid for div
          const {
            onPreviousClick,
            onNextClick,
            previousMonth,
            nextMonth,
            ...divProps
          } = props
          
          return (
            <div className="flex items-center justify-between w-full" {...divProps}>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 flex items-center justify-center mt-0.5 cursor-pointer"
                  onClick={goToPreviousYear}
                  aria-label="Previous year"
                  type="button"
                >
                  <ChevronsLeftIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 flex items-center justify-center mt-0.5 cursor-pointer"
                  onClick={goToPreviousMonth}
                  aria-label="Previous month"
                  type="button"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
              </div>
              
              <div className="flex-1 text-center">
                {children}
              </div>
              
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 flex items-center justify-center mt-0.5 cursor-pointer"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  type="button"
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 flex items-center justify-center mt-0.5 cursor-pointer"
                  onClick={goToNextYear}
                  aria-label="Next year"
                  type="button"
                >
                  <ChevronsRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  
  // Improved focus handling to prevent multiple focus calls
  React.useEffect(() => {
    if (modifiers.focused && document.activeElement !== ref.current) {
      ref.current?.focus()
    }
  }, [modifiers.focused])

  const isSelected = modifiers.selected && 
    !modifiers.range_start && 
    !modifiers.range_end && 
    !modifiers.range_middle

  const isRangeStart = modifiers.range_start
  const isRangeEnd = modifiers.range_end
  const isRangeMiddle = modifiers.range_middle
  const isToday = modifiers.today
  const isOutside = modifiers.outside
  const isDisabled = modifiers.disabled

  // Use ISO date string for consistent, locale-agnostic data attribute
  const dayKey = day.date.toISOString().split('T')[0]

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={dayKey}
      data-selected-single={isSelected}
      data-range-start={isRangeStart}
      data-range-end={isRangeEnd}
      data-range-middle={isRangeMiddle}
      data-today={isToday}
      data-outside={isOutside}
      data-disabled={isDisabled}
      aria-label={`${day.date.toLocaleDateString()}${
        isSelected ? ' (selected)' : ''
      }${isToday ? ' (today)' : ''}${isDisabled ? ' (disabled)' : ''}`}
      disabled={isDisabled}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
        DEFAULT_CLASSNAMES.day,
        className
      )}
      {...props}
    />
  )
}

// Add display names for DevTools clarity
Calendar.displayName = "Calendar"
CalendarDayButton.displayName = "CalendarDayButton"

export { Calendar, CalendarDayButton }
