import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Image as ImageIcon, Loader2, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Gallery() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

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

  const handleImageClick = (orderId: string) => {
    setLocation(`/orders?highlight=${orderId}`);
  };

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
          {images.map((imageData: any) => (
            <Card 
              key={imageData.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              onClick={() => handleImageClick(imageData.orderId)}
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
    </div>
  );
}
