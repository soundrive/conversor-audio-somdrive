import React, { useState, useEffect } from "react";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface AdminLoginProps {
  onNavigate: (path: string) => void;
}

export default function AdminLogin({ onNavigate }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in as admin in the active session
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const adminRef = doc(db, "admins", user.uid);
          const adminDoc = await getDoc(adminRef);
          const isBootstrapAdmin = user.email === "sertanejopremiercontato@gmail.com";
          const isActiveAdmin = (adminDoc.exists() && adminDoc.data()?.active === true) || isBootstrapAdmin;

          if (isActiveAdmin) {
            onNavigate("/admin");
          } else {
            await signOut(auth);
            setError("Acesso recusado.");
          }
        } catch (err: any) {
          console.error("Error verifying admin status:", err);
          setError("Acesso recusado.");
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Preencha o login e a senha.");
      return;
    }

    setLoading(true);

    try {
      // Enforce browserSessionPersistence
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (pErr) {
        console.warn("[AUTH PERSISTENCE] Warning setting persistence:", pErr);
      }

      // 1. Authenticate with email/password
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Check admin authorization in Firestore
      const adminRef = doc(db, "admins", user.uid);
      let adminDoc;
      try {
        adminDoc = await getDoc(adminRef);
      } catch (dbErr: any) {
        handleFirestoreError(dbErr, OperationType.GET, `admins/${user.uid}`);
      }

      const isBootstrapAdmin = user.email === "sertanejopremiercontato@gmail.com";
      const isActiveAdmin = (adminDoc?.exists() && adminDoc.data()?.active === true) || isBootstrapAdmin;

      if (isActiveAdmin) {
        if (!adminDoc?.exists()) {
          await setDoc(adminRef, { active: true, email: user.email }, { merge: true }).catch(() => {});
        }
        setPassword("");
        onNavigate("/admin");
      } else {
        await signOut(auth);
        setPassword("");
        setError("Acesso recusado.");
      }
    } catch (err: any) {
      setPassword("");
      console.error("Login error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setError("Login ou senha incorretos.");
      } else {
        setError("Acesso recusado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center p-4 relative">
      {/* Back button */}
      <button
        onClick={() => onNavigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-card-inner hover:bg-card-elevated border border-border-main rounded-xl text-xs font-bold text-text-sec hover:text-text-main transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao Início</span>
      </button>

      {/* Clean & Minimalist Central Card */}
      <div className="bg-card-main border border-border-main rounded-[28px] max-w-sm w-full p-8 space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-primary" />
        
        <div className="text-center space-y-3">
          <div className="p-3 bg-card-inner rounded-2xl border border-border-main text-green-primary inline-flex">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-text-main">
            Acesso Restrito
          </h2>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center justify-center gap-2 font-semibold text-center">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
              Login
            </label>
            <input
              type="text"
              name="admin-login"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Login"
              className="w-full bg-card-inner border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
              Senha
            </label>
            <input
              type="password"
              name="admin-password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-card-inner border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-green-primary hover:bg-green-dark disabled:bg-green-primary/50 text-white rounded-xl font-extrabold text-xs shadow-md transition-colors cursor-pointer select-none mt-2"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
