import { useState } from 'react';
import type { Subject } from './App';

interface AddTopicFormProps {
  onTopicAdded: () => void;
}

export default function AddTopicForm({ onTopicAdded }: AddTopicFormProps) {
  const [label, setLabel] = useState('');
  const [subject, setSubject] = useState<Subject>('CS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects: Subject[] = [
    'Math', 'CS', 'Physics', 'Biology', 'Chemistry', 
    'Engineering', 'Economics', 'Psychology', 'Sociology',
    'Philosophy', 'History', 'Literature', 'Art', 'Music', 
    'Language', 'Other'
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!label.trim()) {
      setError('Topic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:4000/api/tree/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label, subject }),
      });

      if (!response.ok) {
        throw new Error('Failed to add topic');
      }

      setLabel('');
      setSubject('CS');
      onTopicAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-topic-form">
      <input
        type="text"
        placeholder="Topic name..."
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={isSubmitting}
        className="form-input"
      />
      
      <select 
        value={subject} 
        onChange={(e) => setSubject(e.target.value as Subject)}
        disabled={isSubmitting}
        className="form-select"
      >
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <button type="submit" disabled={isSubmitting} className="form-button">
        {isSubmitting ? 'Adding...' : 'Add Topic'}
      </button>
      
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
