'use client'

import { useState, useTransition } from 'react'
import { addComment } from '@/app/actions/comments'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

export function CommentForm({ versionId }: { versionId: string }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await addComment(versionId, content)
      if (res.error) {
        setError(res.error)
      } else {
        setContent('')
        setError(null)
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Dodaj komentarz…"
        aria-label="Treść komentarza"
      />
      {error && (
        <p role="alert" className="text-sm text-fail-strong">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending || content.trim() === ''}>
          {pending ? 'Dodawanie…' : 'Dodaj komentarz'}
        </Button>
      </div>
    </form>
  )
}
