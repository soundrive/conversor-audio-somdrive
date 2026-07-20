import React, { useState, useEffect } from "react";
import { Lock, Mail, ArrowLeft, ShieldAlert } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface AdminLoginProps {
  onNavigate: (path: string) => void;
}

export default function AdminLogin({ onNavigate }: AdminLoginProps) {
  const [email, setEmail] = useState("sertanejopremiercontato@gmail.com");
  const [password, setPassword] = useState("admin123@");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in as admin
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const adminRef = doc(db, "admins", user.uid);
          const adminDoc = await getDoc(adminRef);
          if (adminDoc.exists() && adminDoc.data()?.active === true) {
            onNavigate("/admin");
          } else {
            // Logged in but not authorized admin
            await signOut(auth);
            setError("Acesso recusado. Esta conta não possui privilégios de administrador.");
          }
        } catch (err: any) {
          setError("Erro ao verificar permissões de administrador: " + err.message);
          handleFirestoreError(err, OperationType.GET, `admins/${user.uid}`);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [onNavigate]);

  const handleAutoProvision = async () => {
    setError(null);
    setLoading(true);
    const targetEmail = "sertanejopremiercontato@gmail.com";
    const targetPassword = "admin123@";

    try {
      // 1. Try to sign in first
      try {
        const userCredential = await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
        const user = userCredential.user;
        const adminRef = doc(db, "admins", user.uid);
        await setDoc(adminRef, { active: true }, { merge: true });
        onNavigate("/admin");
      } catch (loginErr: any) {
        if (loginErr.code === "auth/user-not-found" || loginErr.code === "auth/invalid-credential") {
          // 2. If user doesn't exist, create it!
          const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
          const user = userCredential.user;
          const adminRef = doc(db, "admins", user.uid);
          await setDoc(adminRef, { active: true });
          onNavigate("/admin");
        } else {
          throw loginErr;
        }
      }
    } catch (err: any) {
      console.error("Auto-provision error:", err);
      setError("Erro ao configurar sua conta: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        // 1. Register with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create admin document in Firestore
        const adminRef = doc(db, "admins", user.uid);
        try {
          await setDoc(adminRef, { active: true });
        } catch (dbErr: any) {
          handleFirestoreError(dbErr, OperationType.CREATE, `admins/${user.uid}`);
        }

        // Redirect directly to admin panel!
        onNavigate("/admin");
      } else {
        // 1. Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Check admin document in Firestore
        const adminRef = doc(db, "admins", user.uid);
        let adminDoc;
        try {
          adminDoc = await getDoc(adminRef);
        } catch (dbErr: any) {
          handleFirestoreError(dbErr, OperationType.GET, `admins/${user.uid}`);
        }

        if (adminDoc.exists() && adminDoc.data()?.active === true) {
          // Authorized!
          onNavigate("/admin");
        } else {
          // Not an admin - sign out immediately and show error
          await signOut(auth);
          setError("Acesso recusado. Esta conta não possui privilégios de administrador.");
        }
      }
    } catch (err: any) {
      console.error(isRegistering ? "Registration error:" : "Login error:", err);
      // Friendly messages
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("E-mail ou senha incorretos. Se você é novo ou ainda não possui uma conta de administrador cadastrada, clique em 'Cadastre-se' abaixo para registrar seu e-mail.");
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">E-mail Administrativo</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@somdrive.com"
                className="w-full bg-card-inner border border-border-main rounded-xl pl-11 pr-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-card-inner border border-border-main rounded-xl pl-11 pr-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-green-primary hover:bg-green-dark disabled:bg-green-primary/50 text-white rounded-xl font-extrabold text-xs shadow-md transition-colors cursor-pointer select-none"
          >
            {loading ? "Processando..." : isRegistering ? "Criar Conta" : "Entrar no Painel"}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-border-main"></div>
          <span className="flex-shrink mx-4 text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Acesso Direto</span>
          <div className="flex-grow border-t border-border-main"></div>
        </div>

        <button
          type="button"
          onClick={handleAutoProvision}
          disabled={loading}
          className="w-full py-3.5 bg-card-inner hover:bg-card-elevated border border-green-primary/30 hover:border-green-primary/60 text-green-primary rounded-xl font-extrabold text-xs shadow-sm transition-all cursor-pointer select-none flex items-center justify-center gap-2"
        >
          <Lock className="h-4 w-4" />
          {loading ? "Configurando..." : "Criar & Acessar sertanejopremiercontato@gmail.com"}
        </button>

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
