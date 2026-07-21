import React, { useState, useEffect } from "react";
import { Lock, Mail, ArrowLeft, ShieldAlert, CheckSquare, Square } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface AdminLoginProps {
  onNavigate: (path: string) => void;
}

export default function AdminLogin({ onNavigate }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionOnly, setSessionOnly] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in as admin in the current active session
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
            // Logged in but not authorized admin
            await signOut(auth);
            setError("Acesso recusado. Esta conta não possui privilégios de administrador.");
          }
        } catch (err: any) {
          console.error("Error verifying admin status:", err);
          setError("Erro ao verificar permissões de administrador: " + (err.message || String(err)));
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
      setError("Por favor, preencha o e-mail e a senha de acesso.");
      return;
    }

    setLoading(true);

    try {
      // Enforce strict Firebase Auth persistence (sessionOnly or inMemoryPersistence)
      // NEVER use browserLocalPersistence for administrative access
      try {
        const chosenPersistence = sessionOnly ? browserSessionPersistence : inMemoryPersistence;
        await setPersistence(auth, chosenPersistence);
      } catch (pErr) {
        console.warn("[AUTH PERSISTENCE] Warning setting persistence:", pErr);
      }

      if (isRegistering) {
        // 1. Register with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        // 2. Create admin document in Firestore
        const adminRef = doc(db, "admins", user.uid);
        try {
          await setDoc(adminRef, { active: true, email: user.email, createdAt: new Date().toISOString() }, { merge: true });
        } catch (dbErr: any) {
          handleFirestoreError(dbErr, OperationType.CREATE, `admins/${user.uid}`);
        }

        // Clear password state immediately after authentication
        setPassword("");
        onNavigate("/admin");
      } else {
        // 1. Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        // 2. Check admin document in Firestore
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
          // If bootstrap admin doc doesn't exist yet, create it
          if (!adminDoc?.exists()) {
            await setDoc(adminRef, { active: true, email: user.email }, { merge: true }).catch(() => {});
          }
          // Clear password state immediately after authentication
          setPassword("");
          onNavigate("/admin");
        } else {
          // Not authorized - sign out immediately and clear password
          await signOut(auth);
          setPassword("");
          setError("Acesso recusado. Esta conta não possui privilégios de administrador.");
        }
      }
    } catch (err: any) {
      setPassword(""); // Clear password immediately on error
      console.error(isRegistering ? "Registration error:" : "Login error:", err);

      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso por outra conta.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve conter pelo menos 6 caracteres.");
      } else {
        setError(`Erro na ${isRegistering ? "criação de conta" : "autenticação"}: ` + (err.message || err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center p-4">
      {/* Back button */}
      <button
        onClick={() => onNavigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-card-inner hover:bg-card-elevated border border-border-main rounded-xl text-xs font-bold text-text-sec hover:text-text-main transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao Início</span>
      </button>

      <div className="bg-card-main border border-border-main rounded-[28px] max-w-md w-full p-8 space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-primary" />
        
        <div className="text-center space-y-3">
          <div className="p-3 bg-card-inner rounded-2xl border border-border-main text-green-primary inline-flex">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-text-main">
            {isRegistering ? "Criar Conta de Administrador" : "Acesso Restrito"}
          </h2>
          <p className="text-xs text-text-sec font-semibold leading-relaxed">
            {isRegistering 
              ? "Crie uma nova conta administrativa para gerenciar o site." 
              : "Painel Administrativo para controle de anúncios e configurações."}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2.5 font-semibold text-left">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
              E-mail Administrativo
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="email"
                name="admin-email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@somdrive.com"
                className="w-full bg-card-inner border border-border-main rounded-xl pl-11 pr-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="password"
                name="admin-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-card-inner border border-border-main rounded-xl pl-11 pr-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
              />
            </div>
          </div>

          {/* SESSION PERSISTENCE OPTION */}
          <div
            onClick={() => setSessionOnly(!sessionOnly)}
            className="flex items-center gap-2.5 py-1 text-left cursor-pointer select-none group"
          >
            <button
              type="button"
              className="text-green-primary focus:outline-none cursor-pointer"
            >
              {sessionOnly ? (
                <CheckSquare className="h-4 w-4 text-green-primary" />
              ) : (
                <Square className="h-4 w-4 text-text-muted group-hover:text-text-sec" />
              )}
            </button>
            <span className="text-[11px] font-bold text-text-sec group-hover:text-text-main transition-colors">
              Manter conectado somente nesta sessão
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-green-primary hover:bg-green-dark disabled:bg-green-primary/50 text-white rounded-xl font-extrabold text-xs shadow-md transition-colors cursor-pointer select-none"
          >
            {loading ? "Verificando..." : isRegistering ? "Criar Conta de Administrador" : "Entrar no Painel"}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-xs text-green-primary hover:text-green-dark font-extrabold transition-colors cursor-pointer"
          >
            {isRegistering 
              ? "Já possui uma conta? Entrar" 
              : "Não tem uma conta? Cadastre-se"}
          </button>
        </div>
      </div>
    </div>
  );
}

