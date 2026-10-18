"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import type { Escrow } from "@/types";

import { ITEMS_PER_PAGE } from "./vendorListShared";

/**
 * Owns the search / status / date-range filter state, derives the filtered
 * list, and paginates it. Changing any filter resets back to page one, and
 * the exposed page is always clamped to the current filtered total so a
 * shrinking list (cancellation, reload) never leaves an empty trailing page.
 */
export function useEscrowFilters(escrows: Escrow[] | null) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    startTransition(() => setCurrentPage(1));
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const filteredEscrows = useMemo(() => {
    if (!escrows) return null;

    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const end = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return escrows.filter((escrow) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        escrow.id.toLowerCase().includes(query) ||
        (escrow.vendorId && escrow.vendorId.toLowerCase().includes(query)) ||
        (escrow.buyerId && escrow.buyerId.toLowerCase().includes(query)) ||
        (escrow.item && escrow.item.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "ALL" || escrow.status === statusFilter;

      const created = new Date(escrow.createdAt).getTime();
      const matchesDate =
        (start === null || created >= start) && (end === null || created <= end);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [escrows, searchQuery, statusFilter, fromDate, toDate]);

  const totalPages = filteredEscrows
    ? Math.ceil(filteredEscrows.length / ITEMS_PER_PAGE)
    : 0;

  // Derived rather than synced via an effect so the first render after the
  // list shrinks is already in bounds. Never drops below page one.
  const lastPage = Math.max(1, totalPages);
  const effectivePage = Math.min(Math.max(1, currentPage), lastPage);

  const paginatedEscrows = useMemo(() => {
    if (!filteredEscrows) return [];
    const startIndex = (effectivePage - 1) * ITEMS_PER_PAGE;
    return filteredEscrows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEscrows, effectivePage]);

  const clearDateFilter = () => {
    setFromDate("");
    setToDate("");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    clearDateFilter();
  };

  // Step from the clamped page so a stale out-of-range value cannot leak back.
  const goToPreviousPage = () => setCurrentPage(Math.max(1, effectivePage - 1));
  const goToNextPage = () =>
    setCurrentPage(Math.min(lastPage, effectivePage + 1));

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    currentPage: effectivePage,
    filteredEscrows,
    paginatedEscrows,
    totalPages,
    clearDateFilter,
    resetFilters,
    goToPreviousPage,
    goToNextPage,
  };
}
