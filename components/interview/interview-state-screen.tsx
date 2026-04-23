interface InterviewStateScreenProps {
  title: string;
  message?: string;
}

export function InterviewStateScreen({ title, message }: InterviewStateScreenProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12 sm:py-16">
      <div className="w-full space-y-4 border border-border/60 bg-background p-6 shadow-xs">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {message ? <p className="text-sm leading-6 text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
