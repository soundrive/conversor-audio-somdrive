import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Ad } from "../types";
import PublicAdCard from "./PublicAdCard";

interface AdBannerProps {
  positionId: string;
  toolName?: string;
}

export default function AdBanner({ positionId, toolName }: AdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [failedAdIds, setFailedAdIds] = useState<string[]>([]);

  useEffect(() => {
    const q = collection(db, "ads");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const now = new Date();
        const nowTime = now.getTime();
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Ad))
          .filter((ad) => ad.active !== false && ad.isActive !== false)
          .filter((ad) => {
            if (positionId && ad.position !== positionId && ad.position !== "all") {
              return false;
            }
            return true;
          });
        setAds(list);
      } catch (err) {
        console.error("Error fetching ads in AdBanner:", err);
      }
    });

    return () => unsubscribe();
  }, [positionId]);

  const activeAds = ads.filter((a) => !failedAdIds.includes(a.id));

  if (activeAds.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex justify-center my-4">
      <PublicAdCard
        ad={activeAds[0]}
        position={positionId}
        onImageError={(id) => setFailedAdIds((prev) => [...prev, id])}
      />
    </div>
  );
}
