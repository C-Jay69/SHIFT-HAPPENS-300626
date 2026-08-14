import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store.tsx';
import { Table, TableStatus } from '../types.ts';
import { Plus, Trash2, Edit2, Grip, RotateCw, Maximize2, Minimize2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const GRID_SIZE = 20;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const TABLE_SHAPES = {
  square: { width: 80, height: 80, seats: 4 },
  rectangle: { width: 120, height: 80, seats: 6 },
  round: { width: 80, height: 80, seats: 4 },
  largeRound: { width: 100, height: 100, seats: 8 },
};

const STATUS_COLORS: Record<TableStatus, { bg: string; border: string; text: string }> = {
  [TableStatus.AVAILABLE]: { bg: 'bg-white', border: 'border-green-500', text: 'text-green-700' },
  [TableStatus.OCCUPIED]: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700' },
  [TableStatus.RESERVED]: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700' },
  [TableStatus.DIRTY]: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-600' },
};

const snapToGrid = (value: number): number => {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
};

const FloorPlan = () => {
  const { tables, addTable, updateTable, deleteTable, updateTableStatus, reservations } = useAppStore();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableShape, setNewTableShape] = useState<keyof typeof TABLE_SHAPES>('square');
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragTableId, setDragTableId] = useState<string | null>(null);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, table: Table) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).classList.contains('table-handle') || 
        (e.target as HTMLElement).closest('.table-handle')) {
      setIsDraggingTable(true);
      setDragTableId(table.id);
      setDragStart({ x: e.clientX - table.x * zoom - pan.x, y: e.clientY - table.y * zoom - pan.y });
    }
  }, [zoom, pan]);

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingTable && dragTableId) {
      const newX = snapToGrid((e.clientX - dragStart.x - pan.x) / zoom);
      const newY = snapToGrid((e.clientY - dragStart.y - pan.y) / zoom);
      
      const clampedX = Math.max(0, Math.min(newX, CANVAS_WIDTH - TABLE_SHAPES.square.width));
      const clampedY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - TABLE_SHAPES.square.height));
      
      updateTable(dragTableId, { x: clampedX, y: clampedY });
    }
  }, [isDraggingTable, dragTableId, dragStart, pan, zoom, updateTable]);

  const handleDocumentMouseUp = useCallback(() => {
    setIsDraggingTable(false);
    setDragTableId(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [handleDocumentMouseMove, handleDocumentMouseUp]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.5, Math.min(2, prev * delta)));
    }
  }, []);

  const openTableModal = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setShowTableModal(true);
    } else {
      setIsAddingTable(true);
      setShowTableModal(true);
    }
  };

  const closeTableModal = () => {
    setShowTableModal(false);
    setIsAddingTable(false);
    setEditingTable(null);
  };

  const saveTable = () => {
    if (editingTable) {
      updateTable(editingTable.id, { 
        name: editingTable.name, 
        seats: editingTable.seats,
        capacity: editingTable.seats,
        shape: editingTable.shape 
      });
    } else if (isAddingTable) {
      const shape = TABLE_SHAPES[newTableShape];
      const newTable: Table = {
        id: `table_${Date.now()}`,
        name: `Table ${tables.length + 1}`,
        seats: shape.seats,
        capacity: shape.seats,
        status: TableStatus.AVAILABLE,
        x: 100,
        y: 100,
        shape: newTableShape,
      };
      addTable(newTable);
    }
    closeTableModal();
  };

  const deleteTableHandler = (table: Table) => {
    if (window.confirm(`Delete ${table.name}?`)) {
      deleteTable(table.id);
    }
  };

  const getTableReservation = (tableId: string) => {
    return reservations.find(r => r.tableId === tableId && r.status !== 'CANCELLED');
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F5F5]">
      {/* Toolbar */}
      <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-shift-dark">Floor Plan</h2>
          <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono text-gray-600">
            {tables.length} tables
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2">
            <button 
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom out"
            >
              <Minimize2 size={18} />
            </button>
            <span className="px-3 font-mono text-sm text-gray-600 min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom in"
            >
              <Maximize2 size={18} />
            </button>
            <button 
              onClick={() => setZoom(1)}
              className="px-2 hover:bg-gray-100 rounded"
              title="Reset zoom"
            >
              <RotateCw size={18} />
            </button>
          </div>
          <button 
            onClick={() => openTableModal()}
            className="bg-shift-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-black"
          >
            <Plus size={18} /> Add Table
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 overflow-hidden relative"
        ref={setCanvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="absolute inset-0 bg-gray-50"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          }}
        >
          {/* Grid */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            }}
          />

          {/* Tables */}
          {tables.map(table => {
            const reservation = getTableReservation(table.id);
            const statusColors = STATUS_COLORS[table.status];
            const shape = TABLE_SHAPES[table.shape || 'square'];
            const isSelected = selectedTable?.id === table.id;
            const isDragging = isDraggingTable && dragTableId === table.id;

            return (
              <div
                key={table.id}
                className="absolute table-node select-none transition-all duration-150"
                style={{
                  left: table.x,
                  top: table.y,
                  width: shape.width,
                  height: shape.height,
                  zIndex: isDragging ? 100 : isSelected ? 10 : 1,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedTable(table);
                  handleTableMouseDown(e, table);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTable(table);
                }}
              >
                <div 
                  className={`table-handle absolute inset-0 rounded-lg border-2 flex flex-col items-center justify-center ${statusColors.bg} ${statusColors.border} ${statusColors.text} shadow-lg`}
                  style={{
                    borderRadius: table.shape === 'round' || table.shape === 'largeRound' ? '50%' : '8px',
                  }}
                >
                  <div className="flex items-center justify-between w-full px-2 py-1">
                    <span className="font-mono text-xs font-bold">{table.name}</span>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTableModal(table);
                          }}
                          className="p-1 hover:bg-black/10 rounded"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTableHandler(table);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-2xl font-bold">{table.seats}</span>
                    <span className="ml-1 text-xs font-mono opacity-70">seats</span>
                  </div>
                  {reservation && (
                    <div className="px-2 py-1 text-xs font-bold bg-white/80 rounded w-full text-center">
                      {reservation.guestName} • {reservation.guests} guests
                    </div>
                  )}
                </div>
                {isSelected && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newStatus = table.status === TableStatus.AVAILABLE ? TableStatus.RESERVED : TableStatus.AVAILABLE;
                        updateTableStatus(table.id, newStatus);
                      }}
                      className="p-1.5 bg-white border border-gray-200 rounded shadow hover:bg-gray-50"
                      title={table.status === TableStatus.AVAILABLE ? 'Reserve' : 'Release'}
                    >
                      {table.status === TableStatus.AVAILABLE ? <Check size={12} className="text-green-600" /> : <X size={12} className="text-red-600" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTableStatus(table.id, TableStatus.DIRTY);
                      }}
                      className="p-1.5 bg-white border border-gray-200 rounded shadow hover:bg-gray-50"
                      title="Mark Dirty"
                    >
                      <RotateCw size={12} className="text-gray-600" />
                    </button>
                  </div>
                )}
                {isDragging && (
                  <Grip className="absolute -top-6 left-1/2 -translate-x-1/2 text-gray-400" size={20} />
                )}
              </div>
            );
          })}

          {/* Add table preview */}
          {isAddingTable && !showTableModal && (
            <div
              className="absolute table-node pointer-events-none opacity-50"
              style={{
                left: 100,
                top: 100,
                width: TABLE_SHAPES[newTableShape].width,
                height: TABLE_SHAPES[newTableShape].height,
              }}
            >
              <div className="absolute inset-0 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-sm">Click to place table</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingTable ? 'Edit Table' : 'Add Table'}</h3>
              <button onClick={closeTableModal} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>

            {!editingTable && (
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase mb-2 block">Table Shape</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(TABLE_SHAPES).map(([key, shape]) => (
                    <button
                      key={key}
                      onClick={() => setNewTableShape(key as keyof typeof TABLE_SHAPES)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        newTableShape === key 
                          ? 'border-shift-blue bg-blue-50' 
                          : 'border-gray-200 hover:border-shift-blue'
                      }`}
                    >
                      <div 
                        className="w-16 h-16 border-2 border-gray-300 flex items-center justify-center"
                        style={{
                          borderRadius: key === 'round' || key === 'largeRound' ? '50%' : '8px',
                          backgroundColor: key === 'round' || key === 'largeRound' ? 'transparent' : 'transparent',
                        }}
                      >
                        <span className="font-bold text-gray-600">{shape.seats}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-600 capitalize">{key}</span>
                      <span className="text-[10px] text-gray-400">{shape.seats} seats</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Table Name</label>
              <input
                type="text"
                value={editingTable?.name || ''}
                onChange={(e) => setEditingTable(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                placeholder="e.g., Table 5, Booth A, Bar 1"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Seats</label>
              <input
                type="number"
                min="1"
                max="20"
                value={editingTable?.seats || TABLE_SHAPES[newTableShape].seats}
                onChange={(e) => setEditingTable(prev => prev ? { ...prev, seats: Number(e.target.value) } : null)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={closeTableModal} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveTable} className="flex-1 py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black">
                {editingTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Table Info Panel */}
      {selectedTable && (
        <div className="fixed bottom-4 right-4 md:bottom-auto md:top-16 md:right-4 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-4 z-40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-shift-dark">{selectedTable.name}</h3>
            <button onClick={() => setSelectedTable(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Seats:</span>
              <span className="font-bold">{selectedTable.seats}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selectedTable.status].bg} ${STATUS_COLORS[selectedTable.status].text}`}>
                {selectedTable.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Position:</span>
              <span className="font-mono font-bold">({selectedTable.x}, {selectedTable.y})</span>
            </div>
            {getTableReservation(selectedTable.id) && (
              <div className="pt-2 border-t border-gray-100">
                <p className="font-bold text-sm text-shift-dark mb-1">Current Reservation</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>{getTableReservation(selectedTable.id)!.guestName}</p>
                  <p>{getTableReservation(selectedTable.id)!.guests} guests • {getTableReservation(selectedTable.id)!.time}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="fixed bottom-4 left-4 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-4">
        <h4 className="font-bold text-sm text-gray-700 mb-2">Table Status</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${colors.bg} ${colors.border}`}>
                <span className={`text-xs font-bold ${colors.text}`}>•</span>
              </div>
              <span className="text-xs font-medium text-gray-600 capitalize">{status.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FloorPlan;