from rest_framework.pagination import PageNumberPagination


class SafePageNumberPagination(PageNumberPagination):
    """
    FIX: Standard PageNumberPagination honours a client-supplied ?page_size=
    query parameter when page_size_query_param is set.  Even without that,
    a client can send very large page numbers to cause slow OFFSET queries.

    This subclass:
    - Caps page_size at MAX_PAGE_SIZE (200) so no single request can
      retrieve the entire table.
    - Does NOT expose page_size_query_param — clients cannot override it.
    """

    page_size = 50
    max_page_size = 200
    # Deliberately not setting page_size_query_param — clients cannot change it
