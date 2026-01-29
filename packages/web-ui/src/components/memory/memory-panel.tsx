'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Search,
  Filter,
  Download,
  Upload,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemories, useMemoryStats, useClearMemories, useMemoryImportExport } from '@/hooks/use-memory'
import { MemoryEntry } from './memory-entry'
import type { MemoryType, MemoryImportance } from '@/lib/api/memory'

interface MemoryPanelProps {
  trigger?: React.ReactNode
}

export function MemoryPanel({ trigger }: MemoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<MemoryType[]>([])
  const [selectedImportance, setSelectedImportance] = useState<MemoryImportance | 'all'>('all')

  const {
    memories,
    isLoading,
    remove,
    isDeleting,
    updateFilters,
  } = useMemories({
    search: searchQuery || undefined,
    type: selectedTypes.length > 0 ? selectedTypes : undefined,
    importance: selectedImportance !== 'all' ? selectedImportance : undefined,
  })

  const { stats, isLoading: isLoadingStats } = useMemoryStats()
  const { clear: clearAll, isClearing } = useClearMemories()
  const { exportToFile, importFromFile, isExporting, isImporting } = useMemoryImportExport()

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    updateFilters({ search: query || undefined })
  }

  const handleTypeFilter = (type: MemoryType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type]
    setSelectedTypes(newTypes)
    updateFilters({ type: newTypes.length > 0 ? newTypes : undefined })
  }

  const handleImportanceFilter = (importance: string) => {
    const value = importance as MemoryImportance | 'all'
    setSelectedImportance(value)
    updateFilters({ importance: value !== 'all' ? value : undefined })
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await importFromFile(file)
      e.target.value = '' // Reset input
    }
  }

  const memoryTypes: MemoryType[] = ['fact', 'preference', 'context', 'instruction', 'skill', 'relationship']

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            Memory
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <SheetTitle>Atlas Memory</SheetTitle>
            </div>
            {stats && (
              <Badge variant="secondary">
                {stats.total} memories
              </Badge>
            )}
          </div>
          <SheetDescription>
            View, search, and manage stored memories
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => handleSearch('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => exportToFile()}
              disabled={isExporting}
              title="Export memories"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>

            <label>
              <Button
                variant="outline"
                size="icon"
                disabled={isImporting}
                title="Import memories"
                asChild
              >
                <span>
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-danger hover:text-danger"
                  disabled={isClearing || !stats?.total}
                  title="Clear all memories"
                >
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-danger" />
                    Clear All Memories
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats?.total} memories.
                    This action cannot be undone. Consider exporting your
                    memories first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearAll()}
                    className="bg-danger text-danger-foreground hover:bg-danger/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Type:
            </div>
            {memoryTypes.map((type) => (
              <Badge
                key={type}
                variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => handleTypeFilter(type)}
              >
                {type}
              </Badge>
            ))}

            <div className="ml-auto">
              <Select value={selectedImportance} onValueChange={handleImportanceFilter}>
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue placeholder="Importance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Memory List */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            {isLoading || isLoadingStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || selectedTypes.length > 0 || selectedImportance !== 'all'
                    ? 'No memories match your filters'
                    : 'No memories stored yet'}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Memories are created as you interact with Atlas
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3 pr-4">
                  {memories.map((memory) => (
                    <MemoryEntry
                      key={memory.id}
                      memory={memory}
                      onDelete={remove}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
