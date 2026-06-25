import { useEffect, useMemo, useState } from "react";

import { listInventoryStock } from "../services/adminService";

const EMPTY_SUMMARY = {
  total_productos: 0,
  stock_total_unidades: 0,
  productos_stock_bajo: 0,
  productos_sin_stock: 0,
};

export default function useAdminInventoryStock({ canViewInventory }) {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(EMPTY_SUMMARY);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("all");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");

  const hasInventoryFilters = useMemo(() => {
    return Boolean(inventorySearch.trim()) || inventoryStatusFilter !== "all";
  }, [inventorySearch, inventoryStatusFilter]);

  const loadInventory = async () => {
    if (!canViewInventory) return;

    setInventoryLoading(true);
    setInventoryError("");

    try {
      const data = await listInventoryStock(undefined, {
        search: inventorySearch,
        status: inventoryStatusFilter,
      });

      setInventoryItems(Array.isArray(data?.results) ? data.results : []);
      setInventorySummary(data?.summary ? { ...EMPTY_SUMMARY, ...data.summary } : EMPTY_SUMMARY);
    } catch (errorData) {
      setInventoryItems([]);
      setInventorySummary(EMPTY_SUMMARY);
      setInventoryError(errorData?.detail || "No se pudo cargar el inventario.");
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewInventory) return;

    const timeoutId = window.setTimeout(() => {
      loadInventory();
    }, inventorySearch.trim() ? 250 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [inventorySearch, inventoryStatusFilter, canViewInventory]);

  return {
    inventoryItems,
    inventorySummary,
    inventorySearch,
    setInventorySearch,
    inventoryStatusFilter,
    setInventoryStatusFilter,
    inventoryLoading,
    inventoryError,
    hasInventoryFilters,
    loadInventory,
  };
}
