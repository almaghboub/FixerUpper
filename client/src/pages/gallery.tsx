import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Image as ImageIcon, Loader2, Package, ChevronLeft, ChevronRight, Trash2, X, ExternalLink, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Gallery() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRTL = i18n.language === 'ar';

  const { data, isLoading } = useQuery({
    queryKey: ["/api/order-images", currentPage, limit],
    queryFn: async () => {
      const response = await fetch(`/api/order-images?page=${currentPage}&limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch images");
      return response.json();
    },
  });

  const images = data?.images || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, hasNext: false, hasPrevious: false, total: 0 };

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await apiRequest("DELETE", `/api/order-images/${imageId}`);
      if (!response.ok) {
        throw new Error("Failed to delete image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-images"] });
      toast({
        title: t('success'),
        description: t('imageDeletedSuccess'),
      });
      setDeletingImageId(null);
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('imageDeleteFailed'),
        variant: "destructive",
      });
      setDeletingImageId(null);
    },
  });

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedImageIndex(null);
    setLocation(`/orders?highlight=${orderId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    setDeletingImageId(imageId);
  };

  const confirmDelete = () => {
    if (deletingImageId) {
      deleteImageMutation.mutate(deletingImageId);
    }
  };

  const goToPreviousImage = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  }, [selectedImageIndex]);

  const goToNextImage = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  }, [selectedImageIndex, images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;
      
      if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        if (isRTL) {
          goToNextImage();
        } else {
          goToPreviousImage();
        }
      } else if (e.key === 'ArrowRight') {
        if (isRTL) {
          goToPreviousImage();
        } else {
          goToNextImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, goToPreviousImage, goToNextImage, isRTL]);

  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <ImageIcon className="w-8 h-8 mr-3" />
          {t('gallery')}
        </h1>
        <div className="text-sm text-muted-foreground">
          {!isLoading && `${images.length} ${t('images')}`}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">{t('noImagesFound')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('uploadImagesInOrders')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((imageData: any, index: number) => (
            <Card 
              key={imageData.id} 
              className="group cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              onClick={() => handleImageClick(index)}
              data-testid={`gallery-image-${imageData.id}`}
            >
              <div className="relative aspect-square bg-muted">
                <img
                  src={imageData.url}
                  alt={imageData.altText || `Order ${imageData.order?.orderNumber || ''}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3EError%3C/text%3E%3C/svg%3E";
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => handleDeleteClick(e, imageData.id)}
                  data-testid={`button-delete-image-${imageData.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  {imageData.order?.orderNumber || t('unknownOrder')}
                </CardTitle>
                {imageData.customer && (
                  <p className="text-xs text-muted-foreground">
                    {imageData.customer.firstName} {imageData.customer.lastName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(imageData.createdAt).toLocaleDateString()}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && pagination.total > 0 && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!pagination.hasPrevious}
            data-testid="button-previous-page"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('previous')}
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
            </span>
            <span className="text-xs text-muted-foreground">
              ({pagination.total} {t('total')})
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!pagination.hasNext}
            data-testid="button-next-page"
          >
            {t('next')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingImageId} onOpenChange={(open) => !open && setDeletingImageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteImageTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteImageConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox Modal */}
      <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden" data-testid="modal-lightbox">
          {selectedImage && (
            <div className="relative flex flex-col h-full">
              {/* Close Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
                onClick={() => setSelectedImageIndex(null)}
                data-testid="button-close-lightbox"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Main Image Container */}
              <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-24">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.altText || `Order ${selectedImage.order?.orderNumber || ''}`}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                  data-testid="img-lightbox-main"
                />
              </div>

              {/* Navigation Arrows */}
              {selectedImageIndex !== null && selectedImageIndex > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} z-50 text-white hover:bg-white/20 h-12 w-12`}
                  onClick={goToPreviousImage}
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
              )}
              {selectedImageIndex !== null && selectedImageIndex < images.length - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} z-50 text-white hover:bg-white/20 h-12 w-12`}
                  onClick={goToNextImage}
                  data-testid="button-next-image"
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              )}

              {/* Image Info Footer */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                <div className="flex items-center justify-between text-white">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                      {selectedImage.order?.orderNumber || t('unknownOrder')}
                    </h3>
                    {selectedImage.customer && (
                      <p className="text-sm text-white/80">
                        {selectedImage.customer.firstName} {selectedImage.customer.lastName}
                      </p>
                    )}
                    <p className="text-xs text-white/60">
                      {new Date(selectedImage.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                      onClick={() => handleViewOrder(selectedImage.orderId)}
                      data-testid="button-view-order-lightbox"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {t('viewOrder')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeletingImageId(selectedImage.id);
                      }}
                      data-testid="button-delete-lightbox"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('delete')}
                    </Button>
                  </div>
                </div>
                {/* Image Counter */}
                <div className="text-center mt-3 text-white/60 text-sm">
                  {selectedImageIndex !== null ? selectedImageIndex + 1 : 0} / {images.length}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
