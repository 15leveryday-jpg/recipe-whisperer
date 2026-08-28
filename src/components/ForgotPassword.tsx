import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword = ({ onBack }: ForgotPasswordProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Password reset email sent!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center">
          <h1 className="font-display text-4xl text-foreground">Recipe Vault</h1>
          <p className="text-muted-foreground mt-2">Reset your password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-xl shadow-card border border-border/50">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-foreground">Check your email for a password reset link.</p>
              <p className="text-sm text-muted-foreground">
                If you don't see it, check your spam folder.
              </p>
              <Button type="button" variant="outline" onClick={onBack} className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background"
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send Reset Link
              </Button>
              <button
                type="button"
                onClick={onBack}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
