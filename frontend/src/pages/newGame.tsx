export default function NewGame(){
    return(
    <div className="min-h-screen bg-[url('/background.jpg')] bg-cover bg-center pt-16">

        <div className="relative w-full h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden perspective-[1000px]">

        {/* Table & Dealer Wrapper - Defines the scale for both */}
        <div className="relative w-[95vw] md:w-[85vw] max-w-[1000px] aspect-[1.8/1]">

          {/* Dealer - Positioned relative to the wrapper (table size) */}
          <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[30%] h-[40%] flex justify-center items-end z-50">
            <img
              src="/dealer.png"
              alt="Dealer"
              className="h-full object-contain drop-shadow-2xl"
            />
            {/* Dealer Hand Position Anchor */}
            <div id="dealer-hand-position" className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-1 h-1"></div>
          </div>

          {/* Table Surface - Fills the wrapper, has the rotation */}
          <div className="w-full h-full transform-style-3d rotate-x-[20deg] transition-transform duration-500 z-10">
            <img
              src="/table.jpg"
              alt="Poker Table"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            />

            {/* Pot in Center - Chips Group Image */}
            {/* <div className="absolute top-[51%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-[2%]">
              {/* Chips Group Image - Centered 
              <div id="chips-group-pot" className="relative w-[15%] aspect-[4/3] min-w-[80px]">
                <img src="/chips-group.png" alt="Pot Chips" className="w-full h-full object-contain drop-shadow-xl" />
              </div>

              {/* POT Text Below 
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1 border border-yellow-500/30">
                <div className="text-yellow-100 font-bold text-sm md:text-lg shadow-black drop-shadow-md whitespace-nowrap">
                  {/* POT: {formatChips(gameState.pot)} 
                </div>
              </div>
            </div> */}
          </div>
        </div>

        
      </div>
    </div>
    )
}