import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthCheck {
  label: string;
  met: boolean;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const checks: StrengthCheck[] = [
    { label: 'לפחות 8 תווים', met: password.length >= 8 },
    { label: 'אות גדולה אחת לפחות', met: /[A-Z]/.test(password) },
    { label: 'אות קטנה אחת לפחות', met: /[a-z]/.test(password) },
    { label: 'מספר אחד לפחות', met: /[0-9]/.test(password) },
    { label: 'תו מיוחד אחד לפחות (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = checks.filter(check => check.met).length;
  const strengthPercentage = (metCount / checks.length) * 100;

  const getStrengthLevel = () => {
    if (metCount === 0) return { text: '', color: '' };
    if (metCount <= 2) return { text: 'חלשה', color: 'text-destructive' };
    if (metCount <= 3) return { text: 'בינונית', color: 'text-orange-500' };
    if (metCount <= 4) return { text: 'טובה', color: 'text-yellow-500' };
    return { text: 'חזקה מאוד', color: 'text-green-500' };
  };

  const getStrengthBarColor = () => {
    if (metCount <= 2) return 'bg-destructive';
    if (metCount <= 3) return 'bg-orange-500';
    if (metCount <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const strength = getStrengthLevel();

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">חוזק הסיסמה:</span>
          <span className={cn("font-semibold", strength.color)}>
            {strength.text}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              getStrengthBarColor()
            )}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Checks List */}
      <div className="space-y-1.5">
        {checks.map((check, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center transition-colors",
                check.met
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {check.met ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3 h-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-2 h-2"
                >
                  <circle cx="8" cy="8" r="3" />
                </svg>
              )}
            </div>
            <span
              className={cn(
                "transition-colors",
                check.met ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
