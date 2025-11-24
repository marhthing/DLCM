import { useState } from "react";
import { useLocation } from "wouter";
import { Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleJoinStream = () => {
    if (name && email) {
      // Store user session in localStorage
      localStorage.setItem("churchUser", JSON.stringify({ name, email, startTime: Date.now() }));
      setLocation("/stream");
    }
  };

  const handleAdminAccess = () => {
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Youtube className="text-primary-foreground" size={32} />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">Church Live Stream</CardTitle>
            <CardDescription className="text-base">
              Sign in to watch and record your attendance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                data-testid="input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={(e) => e.key === "Enter" && handleJoinStream()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleJoinStream()}
              />
            </div>

            <Button
              data-testid="button-join-stream"
              onClick={handleJoinStream}
              className="w-full"
              disabled={!name || !email}
            >
              Join Live Stream
            </Button>
          </div>

          <div className="text-center">
            <Button
              data-testid="link-admin-access"
              variant="link"
              onClick={handleAdminAccess}
              className="text-sm"
            >
              Admin Access
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
