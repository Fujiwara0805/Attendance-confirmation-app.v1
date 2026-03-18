'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Check } from 'lucide-react';
import type { DateSlot, TimeSlot } from '@/app/types';

interface DateSlotPickerProps {
  dateSlots: DateSlot[];
  selectedDate: string | null;
  selectedTimeSlotId: string | null;
  onSelect: (date: string, timeSlot: TimeSlot) => void;
}

export default function DateSlotPicker({
  dateSlots,
  selectedDate,
  selectedTimeSlotId,
  onSelect,
}: DateSlotPickerProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(selectedDate);

  const handleDateClick = (dateSlot: DateSlot) => {
    setExpandedDate(expandedDate === dateSlot.date ? null : dateSlot.date);
  };

  const handleTimeSlotClick = (dateSlot: DateSlot, timeSlot: TimeSlot) => {
    onSelect(dateSlot.date, timeSlot);
  };

  if (dateSlots.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-slate-400">
        日時が設定されていません
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dateSlots.map((dateSlot) => {
        const isExpanded = expandedDate === dateSlot.date;
        const hasSelection = selectedDate === dateSlot.date;

        return (
          <div key={dateSlot.id} className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => handleDateClick(dateSlot)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                hasSelection
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                hasSelection ? 'bg-indigo-100' : 'bg-slate-100'
              }`}>
                <Calendar className={`h-4 w-4 ${hasSelection ? 'text-indigo-600' : 'text-slate-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${hasSelection ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {dateSlot.label}
                </p>
                <p className="text-xs text-slate-400">
                  {dateSlot.timeSlots.length}つの時間帯
                </p>
              </div>
              {hasSelection && (
                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
              )}
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-slate-100 px-4 py-3 bg-slate-50/50"
              >
                <div className="grid grid-cols-1 gap-2">
                  {dateSlot.timeSlots.map((timeSlot) => {
                    const isSelected = selectedDate === dateSlot.date && selectedTimeSlotId === timeSlot.id;

                    return (
                      <button
                        key={timeSlot.id}
                        type="button"
                        onClick={() => handleTimeSlotClick(dateSlot, timeSlot)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                        }`}
                      >
                        <Clock className={`h-4 w-4 shrink-0 ${
                          isSelected ? 'text-indigo-600' : 'text-slate-400'
                        }`} />
                        <span className={`text-sm font-medium ${
                          isSelected ? 'text-indigo-700' : 'text-slate-700'
                        }`}>
                          {timeSlot.label}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-600 ml-auto shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
