{/* Render Review Modal for Host */}
      {userHostBooking && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          bookingId={userHostBooking.id}
          artistId={targetAuthId}
          artistName={artist.stage_name || 'Artist'}
          onSuccess={() => fetchArtistProfile()}
        />
      )}

      {/* Image Lightbox Modal */}
      {activeImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setActiveImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={activeImage} 
              alt="Enlarged view" 
              className="max-w-full max-h-[85vh] object-contain border border-line"
            />
          </div>
        </div>
      )}
    </div>
  );
}
