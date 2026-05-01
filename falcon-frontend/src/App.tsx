import {useEffect, useState} from "react";

export default function App() {
  const [status, setStatus] = useState("...")

    useEffect(() => {
        fetch("/api/health")
            .then(r => r.json())
            .then(d => setStatus(d.status))
    }, [])

    return (
        <div className={"p-8 text-white bg-zinc-900 min-h-screen"}>
            <h1 className={"text-2xl font-semibold"}>Falcon</h1>
            <p className={"text-zinc-400 mt-2"}>Backend: {status}</p>
        </div>
    )
}