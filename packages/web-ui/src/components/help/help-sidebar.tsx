'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  ChevronLeft,
  Book,
  Shield,
  Key,
  Terminal,
  DollarSign,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useHelp, HelpCategory, HelpTopic, HELP_TOPICS } from '@/hooks/use-help'

const categoryIcons: Record<HelpCategory, typeof Shield> = {
  security: Shield,
  credentials: Key,
  commands: Terminal,
  costs: DollarSign,
  'getting-started': Sparkles,
}

const categoryLabels: Record<HelpCategory, string> = {
  security: 'Security',
  credentials: 'Connections',
  commands: 'Commands',
  costs: 'Costs & Usage',
  'getting-started': 'Getting Started',
}

/**
 * Help Sidebar Component
 *
 * A slide-out panel with searchable help topics.
 * Uses the help context for state management.
 */
export function HelpSidebar() {
  const {
    isOpen,
    closeHelp,
    currentTopic,
    searchQuery,
    search,
    setTopic,
    goBack,
    history,
    searchTopics,
    getTopicsByCategory,
  } = useHelp()

  const [activeCategory, setActiveCategory] = useState<HelpCategory | null>(null)

  const searchResults = searchQuery ? searchTopics(searchQuery) : []
  const categoryTopics = activeCategory ? getTopicsByCategory(activeCategory) : []

  const handleCategoryClick = (category: HelpCategory) => {
    setActiveCategory(category)
    search('')
  }

  const handleTopicClick = (topic: HelpTopic) => {
    setTopic(topic.id)
    setActiveCategory(null)
  }

  const handleBack = () => {
    if (currentTopic) {
      if (history.length > 0) {
        goBack()
      } else {
        setTopic('')
        setActiveCategory(null)
      }
    } else if (activeCategory) {
      setActiveCategory(null)
    }
  }

  const showBackButton = currentTopic || activeCategory

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={closeHelp}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {showBackButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="mr-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </Button>
                )}
                <Book className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">
                  {currentTopic
                    ? currentTopic.title
                    : activeCategory
                      ? categoryLabels[activeCategory]
                      : 'Help & Guides'}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={closeHelp}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            {/* Search */}
            {!currentTopic && (
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search help topics..."
                    value={searchQuery}
                    onChange={(e) => search(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {currentTopic ? (
                <TopicContent topic={currentTopic} onTopicClick={handleTopicClick} />
              ) : searchQuery ? (
                <SearchResults results={searchResults} onTopicClick={handleTopicClick} />
              ) : activeCategory ? (
                <CategoryTopics topics={categoryTopics} onTopicClick={handleTopicClick} />
              ) : (
                <CategoryList onCategoryClick={handleCategoryClick} />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                asChild
              >
                <a href="https://docs.atlas.dev" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Full Documentation
                </a>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function CategoryList({
  onCategoryClick,
}: {
  onCategoryClick: (category: HelpCategory) => void
}) {
  const categories: HelpCategory[] = [
    'getting-started',
    'security',
    'credentials',
    'commands',
    'costs',
  ]

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        Choose a topic to learn more about Atlas.
      </p>
      {categories.map((category) => {
        const Icon = categoryIcons[category]
        const topicCount = HELP_TOPICS.filter((t) => t.category === category).length

        return (
          <button
            key={category}
            onClick={() => onCategoryClick(category)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-background-secondary transition-colors text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{categoryLabels[category]}</div>
              <div className="text-sm text-muted-foreground">
                {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CategoryTopics({
  topics,
  onTopicClick,
}: {
  topics: HelpTopic[]
  onTopicClick: (topic: HelpTopic) => void
}) {
  return (
    <div className="p-4 space-y-2">
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onTopicClick(topic)}
          className="w-full flex flex-col gap-1 p-3 rounded-lg hover:bg-background-secondary transition-colors text-left"
        >
          <div className="font-medium">{topic.title}</div>
          <div className="text-sm text-muted-foreground">{topic.summary}</div>
        </button>
      ))}
    </div>
  )
}

function SearchResults({
  results,
  onTopicClick,
}: {
  results: HelpTopic[]
  onTopicClick: (topic: HelpTopic) => void
}) {
  if (results.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No topics found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try different keywords or browse categories.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      {results.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onTopicClick(topic)}
          className="w-full flex flex-col gap-1 p-3 rounded-lg hover:bg-background-secondary transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{topic.title}</span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-background-tertiary">
              {categoryLabels[topic.category]}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">{topic.summary}</div>
        </button>
      ))}
    </div>
  )
}

function TopicContent({
  topic,
  onTopicClick,
}: {
  topic: HelpTopic
  onTopicClick: (topic: HelpTopic) => void
}) {
  const { getTopicById } = useHelp()

  const relatedTopics = topic.relatedTopics
    ?.map((id) => getTopicById(id))
    .filter((t): t is HelpTopic => t !== undefined)

  return (
    <div className="p-6">
      {/* Summary */}
      <p className="text-muted-foreground mb-6">{topic.summary}</p>

      {/* Content */}
      <div className="prose prose-sm prose-invert max-w-none">
        {topic.content.split('\n\n').map((paragraph, i) => {
          // Handle headers
          if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
            return (
              <h3 key={i} className="text-base font-semibold mt-6 mb-3">
                {paragraph.slice(2, -2)}
              </h3>
            )
          }

          // Handle bullet points
          if (paragraph.startsWith('- ') || paragraph.includes('\n- ')) {
            const items = paragraph.split('\n').filter((line) => line.startsWith('- '))
            return (
              <ul key={i} className="space-y-2 my-4">
                {items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm">
                    <span className="text-primary shrink-0">•</span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: item.slice(2).replace(
                          /\*\*(.+?)\*\*/g,
                          '<strong>$1</strong>'
                        ),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )
          }

          // Handle checkmarks
          if (paragraph.includes('✓') || paragraph.includes('✗')) {
            const lines = paragraph.split('\n')
            return (
              <div key={i} className="space-y-1 my-4">
                {lines.map((line, j) => (
                  <div
                    key={j}
                    className={cn(
                      'text-sm flex gap-2',
                      line.startsWith('✓') && 'text-success',
                      line.startsWith('✗') && 'text-muted-foreground'
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )
          }

          // Regular paragraph with inline formatting
          return (
            <p
              key={i}
              className="text-sm leading-relaxed my-4"
              dangerouslySetInnerHTML={{
                __html: paragraph.replace(
                  /\*\*(.+?)\*\*/g,
                  '<strong class="text-foreground">$1</strong>'
                ),
              }}
            />
          )
        })}
      </div>

      {/* Related topics */}
      {relatedTopics && relatedTopics.length > 0 && (
        <>
          <Separator className="my-6" />
          <div>
            <h4 className="text-sm font-medium mb-3">Related topics</h4>
            <div className="space-y-2">
              {relatedTopics.map((related) => (
                <button
                  key={related.id}
                  onClick={() => onTopicClick(related)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background-secondary transition-colors text-left text-sm"
                >
                  <span className="text-primary">→</span>
                  <span>{related.title}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
