import { CSSProperties } from 'react'

const Loader = ({ progress }: { progress: number }) => {
  return (
    <div className="Loader">
      <div className="Loader__wrapper">
        <div
          className="LoadingBar"
          style={
            {
              '--progress': `${progress}%`,
            } as CSSProperties
          }
        ></div>
      </div>
    </div>
  )
}

export default Loader
